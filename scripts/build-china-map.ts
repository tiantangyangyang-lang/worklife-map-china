// ============================================================
// 将中国 GeoJSON 转换为简化的 SVG 路径数据
// 输出: public/data/china-provinces.json
// ============================================================
import * as fs from 'fs';
import * as path from 'path';

interface GeoJSONFeature {
  type: 'Feature';
  properties: { name: string; adcode: number; centroid?: [number, number] };
  geometry: {
    type: 'MultiPolygon' | 'Polygon' | 'MultiLineString' | 'LineString';
    coordinates: number[][][] | number[][][];
  };
}

interface GeoJSONFC {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// 简单的 Mercator 投影 (中国版, 排除南海诸岛以避免过大变形)
// 经度范围: 73-136, 纬度范围: 18-54
const LNG_MIN = 73;
const LNG_MAX = 136;
const LAT_MIN = 18;
const LAT_MAX = 54;

function mercatorY(lat: number): number {
  // Mercator projection y
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function project(lng: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * width;
  // 用 Mercator Y 然后归一化
  const yMin = mercatorY(LAT_MIN);
  const yMax = mercatorY(LAT_MAX);
  const yMerc = mercatorY(lat);
  const y = ((yMax - yMerc) / (yMax - yMin)) * height;
  return [x, y];
}

/** 简单的点抽稀: 每隔 step 取一个点 */
function simplifyRing(ring: number[][], step: number): number[][] {
  if (ring.length <= step * 2) return ring;
  const result: number[][] = [];
  for (let i = 0; i < ring.length; i += step) {
    result.push(ring[i]);
  }
  // 闭合
  if (result.length > 0) {
    const last = result[result.length - 1];
    const first = result[0];
    if (last[0] !== first[0] || last[1] !== first[1]) {
      result.push(first);
    }
  }
  return result;
}

/** 将多边形 ring 转成 SVG path d 属性 */
function ringToPath(ring: number[][], width: number, height: number, step: number): string {
  const simplified = simplifyRing(ring, step);
  if (simplified.length < 3) return '';
  let d = '';
  simplified.forEach((pt, i) => {
    const [x, y] = project(pt[0], pt[1], width, height);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
  });
  return d + 'Z';
}

function main() {
  const ROOT = process.cwd();
  // 输入: DataV 行政区域 GeoJSON (需要先用 curl 下载到本地)
  const input = process.env.GEOJSON_INPUT || '/tmp/china_geo.json';
  // 输出: public/data/china-provinces.json
  const output = process.env.GEOJSON_OUTPUT
    || path.join(ROOT, 'public', 'data', 'china-provinces.json');

  const geojson: GeoJSONFC = JSON.parse(fs.readFileSync(input, 'utf-8'));
  console.log(`📖 Loaded GeoJSON with ${geojson.features.length} features`);

  const WIDTH = 1000;
  const HEIGHT = 700;
  const STEP = 4; // 抽稀步长 (越大越简单)

  const provinces: { name: string; adcode: number; d: string; centroid: [number, number] | null }[] = [];

  for (const feat of geojson.features) {
    const name = feat.properties.name.replace(/省|市|自治区|特别行政区|壮族|回族|维吾尔/g, '') || feat.properties.name;
    const adcode = feat.properties.adcode;
    let allPaths: string[] = [];

    if (feat.geometry.type === 'MultiPolygon') {
      for (const polygon of feat.geometry.coordinates as number[][][][]) {
        // polygon = [outerRing, hole1, hole2, ...]
        for (const ring of polygon) {
          const d = ringToPath(ring, WIDTH, HEIGHT, STEP);
          if (d) allPaths.push(d);
        }
      }
    } else if (feat.geometry.type === 'Polygon') {
      for (const ring of feat.geometry.coordinates as number[][][]) {
        const d = ringToPath(ring, WIDTH, HEIGHT, STEP);
        if (d) allPaths.push(d);
      }
    }

    // 计算 centroid (经纬度)
    let centroid: [number, number] | null = null;
    if (feat.properties.centroid) {
      centroid = feat.properties.centroid;
    }

    provinces.push({
      name,
      adcode,
      d: allPaths.join(' '),
      centroid,
    });
  }

  const outputData = {
    width: WIDTH,
    height: HEIGHT,
    lngRange: [LNG_MIN, LNG_MAX],
    latRange: [LAT_MIN, LAT_MAX],
    provinces,
  };

  fs.writeFileSync(output, JSON.stringify(outputData), 'utf-8');
  console.log(`✅ Written ${output} (${(fs.statSync(output).size / 1024).toFixed(1)} KB)`);
  console.log(`   Provinces: ${provinces.length}`);
  console.log(`   First 5: ${provinces.slice(0, 5).map(p => p.name).join(', ')}`);
}

main();
