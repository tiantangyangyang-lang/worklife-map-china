// ============================================================
// 数据构建脚本: 解析 Excel → 生成 3 个 JSON 文件
// 用法:
//   npm run build:data
//   或 INPUT_FILE=./my-data.xlsx npm run build:data
// ============================================================
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { parseSheetRows } from '../src/lib/normalize';
import { buildCitySummary, buildGeoJSON } from '../src/lib/aggregate';

const ROOT = process.cwd();

// 输入文件: 默认 data/中国公司作息情况.example.xlsx, 可用 INPUT_FILE 环境变量覆盖
const INPUT_FILE = process.env.INPUT_FILE
  || path.join(ROOT, 'data', '中国公司作息情况.example.xlsx');

// 输出目录: 默认 public/data, 可用 OUTPUT_DIR 环境变量覆盖
const OUTPUT_DIR = process.env.OUTPUT_DIR
  || path.join(ROOT, 'public', 'data');

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input Excel not found: ${INPUT_FILE}`);
    console.error('   Set INPUT_FILE env var or place file at data/中国公司作息情况.example.xlsx');
    process.exit(1);
  }

  console.log('📂 Reading Excel:', INPUT_FILE);
  const buffer = fs.readFileSync(INPUT_FILE);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sourceName = path.basename(INPUT_FILE);

  const allRecords: any[] = [];
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n📋 Processing sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    console.log(`   Total rows: ${rows.length}`);
    const records = parseSheetRows(rows, sourceName, sheetName);
    console.log(`   Parsed records: ${records.length}`);
    allRecords.push(...records);
  }

  console.log(`\n✅ Total normalized records: ${allRecords.length}`);

  // 按section统计
  const section955 = allRecords.filter(r => r.section === '955');
  const section965 = allRecords.filter(r => r.section === '965');
  const section996 = allRecords.filter(r => r.section === '996');
  console.log(`   955: ${section955.length}`);
  console.log(`   965: ${section965.length}`);
  console.log(`   996: ${section996.length}`);

  // 风险等级统计
  const riskStats = {
    low: allRecords.filter(r => r.risk_level === 'low').length,
    medium: allRecords.filter(r => r.risk_level === 'medium').length,
    high: allRecords.filter(r => r.risk_level === 'high').length,
    very_high: allRecords.filter(r => r.risk_level === 'very_high').length,
    unknown: allRecords.filter(r => r.risk_level === 'unknown').length,
  };
  console.log('\n📊 Risk distribution:', riskStats);

  // 城市聚合
  const citySummaries = buildCitySummary(allRecords);
  console.log(`\n🏙️  Cities with coordinates: ${citySummaries.length}`);
  console.log('   Top 10 cities by record count:');
  citySummaries.slice(0, 10).forEach(c => {
    console.log(`   - ${c.city} (total: ${c.total}, 955: ${c.count_955}, 996: ${c.count_996}, risk: ${c.risk_score})`);
  });

  const unlocated = allRecords.filter(r => r.geo_level === 'unknown');
  if (unlocated.length > 0) {
    console.log(`\n⚠️  Unlocated records: ${unlocated.length}`);
    const unlocatedCities = new Set(unlocated.map(r => r.city_raw));
    console.log('   Unlocated city_raw values:', Array.from(unlocatedCities).slice(0, 20));
  }

  // 生成 GeoJSON
  const geojson = buildGeoJSON(citySummaries);

  // 写出文件
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const normalizedPath = path.join(OUTPUT_DIR, 'normalized_companies.json');
  const summaryPath = path.join(OUTPUT_DIR, 'city_summary.json');
  const geojsonPath = path.join(OUTPUT_DIR, 'map.geojson');

  fs.writeFileSync(normalizedPath, JSON.stringify(allRecords, null, 2), 'utf-8');
  fs.writeFileSync(summaryPath, JSON.stringify(citySummaries, null, 2), 'utf-8');
  fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf-8');

  console.log(`\n💾 Files written:`);
  console.log(`   ${normalizedPath} (${(fs.statSync(normalizedPath).size / 1024).toFixed(1)} KB)`);
  console.log(`   ${summaryPath} (${(fs.statSync(summaryPath).size / 1024).toFixed(1)} KB)`);
  console.log(`   ${geojsonPath} (${(fs.statSync(geojsonPath).size / 1024).toFixed(1)} KB)`);
}

main();
