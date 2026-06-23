// ============================================================
// 地图投影工具: 与 build-china-map.ts 一致的投影参数
// 用于将 [lng, lat] 投影到 SVG [x, y] 坐标
// ============================================================

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 700;
export const LNG_RANGE: [number, number] = [73, 136];
export const LAT_RANGE: [number, number] = [18, 54];

function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const Y_MIN = mercatorY(LAT_RANGE[0]);
const Y_MAX = mercatorY(LAT_RANGE[1]);

/** 将 [lng, lat] 投影为 SVG [x, y] */
export function project(lng: number, lat: number): [number, number] {
  const x = ((lng - LNG_RANGE[0]) / (LNG_RANGE[1] - LNG_RANGE[0])) * MAP_WIDTH;
  const yMerc = mercatorY(lat);
  const y = ((Y_MAX - yMerc) / (Y_MAX - Y_MIN)) * MAP_HEIGHT;
  return [x, y];
}

export interface ProvincePath {
  name: string;
  adcode: number;
  d: string;
}

export interface ChinaMapData {
  width: number;
  height: number;
  lngRange: [number, number];
  latRange: [number, number];
  provinces: ProvincePath[];
}
