// ============================================================
// 数据标准化: 城市清洗 / 公司名清洗 / 拆分多城市 / 公司级地理字段
// ============================================================
import { findCityCenter } from './city-centers';
import type { SectionTitle, CompanyRecord, GeoLevel, CoordSystem, GeoSource } from './types';
import { classifyWorkSystem, classifyWeekendType, classifyRiskLevel, classifyConfidence, excelDateToString, buildClassificationBasis } from './classify';

/** 非城市关键词 (在拆分时会被过滤) */
const NON_CITY_KEYWORDS = new Set(['remote', 'Remote', 'REMOTE', '远程', '不限', '全国', '多地', 'Linkedin', 'National']);

/**
 * 拆分多城市字段
 * 支持: "北京/上海", "北京, 西安", "深圳-成都-重庆", "上海/苏州/无锡"
 * 同时过滤掉非城市关键词 (e.g. "remote", "Linkedin")
 */
export function splitCities(cityRaw: string): string[] {
  if (!cityRaw) return [];
  const text = cityRaw.trim();
  // 按多种分隔符拆分
  const parts = text.split(/[\/,\-，、\s]+/).map(s => s.trim()).filter(Boolean);
  return parts.filter(p => !NON_CITY_KEYWORDS.has(p));
}

/**
 * 清洗公司名 (去前后空格, 但保留原始 raw 值)
 */
export function cleanCompanyName(raw: string): { name: string; raw: string } {
  if (!raw) return { name: '', raw: '' };
  const trimmed = String(raw).trim();
  return { name: trimmed, raw: String(raw) };
}

/**
 * 解析经度/纬度字符串, 返回数字或 null
 * 兼容: "116.404", "116.404,", 116.404 (number), "经度: 116.404"
 */
function parseCoordinate(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isFinite(val) ? val : null;
  }
  const str = String(val).trim();
  if (!str) return null;
  // 提取数字部分
  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return isFinite(n) ? n : null;
}

/**
 * 校验经纬度是否在中国大致范围内
 * lng: 73-135 (东经 73°-135°), lat: 18-54 (北纬 18°-54°)
 */
function isValidChinaCoordinate(lng: number, lat: number): boolean {
  return lng >= 73 && lng <= 135 && lat >= 18 && lat <= 54;
}

/**
 * 解析坐标系字符串 → CoordSystem
 * 兼容: wgs84 / WGS84 / gcj02 / GCJ02 / bd09 / BD09 / 火星坐标 / 百度坐标 / 国测局坐标
 */
function parseCoordSystem(val: any): CoordSystem {
  const str = String(val || '').trim().toLowerCase();
  if (!str) return 'unknown';
  if (str.includes('wgs84') || str.includes('wgs-84')) return 'wgs84';
  if (str.includes('gcj02') || str.includes('gcj-02') || str.includes('火星') || str.includes('国测')) return 'gcj02';
  if (str.includes('bd09') || str.includes('bd-09') || str.includes('百度')) return 'bd09';
  return 'unknown';
}

/**
 * 推断地理精度等级
 * - 有合法公司经纬度 → 'coordinate'
 * - 有详细地址 → 'address'
 * - 有区县 → 'district'
 * - 有城市 → 'city'
 * - 都没有 → 'unknown'
 */
function inferGeoLevel(
  hasCompanyCoord: boolean,
  address: string,
  district: string,
  hasCity: boolean,
): GeoLevel {
  if (hasCompanyCoord) return 'coordinate';
  if (address) return 'address';
  if (district) return 'district';
  if (hasCity) return 'city';
  return 'unknown';
}

/**
 * 从一行原始数据构造一条标准化 CompanyRecord
 *
 * Excel 列布局 (V2 扩展, 向后兼容):
 *   0: 城市        1: 公司        2: 时间        3: 规则
 *   4-7: 证据1-4
 *   8: 省份 (可选)   9: 区县 (可选)   10: 详细地址 (可选)
 *   11: 经度 (可选)  12: 纬度 (可选)  13: 坐标系 (可选)
 *
 * 公司点位逻辑 (issue #2):
 *   - 如果记录里有合法 lng/lat (列 11/12), 用它作为公司精确坐标, geo_level = 'coordinate'
 *   - 否则 fallback 到城市中心坐标, geo_level = 'city'
 */
export function buildCompanyRecord(
  row: any[],
  rowIndex: number,
  section: SectionTitle,
  sourceName: string,
  sheetName: string,
): CompanyRecord[] {
  const cityRaw = String(row[0] || '').trim();
  const companyRaw = String(row[1] || '').trim();
  const timeRaw = String(row[2] || '').trim();
  const ruleText = String(row[3] || '').trim();
  const evidence1 = String(row[4] || '').trim();
  const evidence2 = String(row[5] || '').trim();
  const evidence3 = String(row[6] || '').trim();
  const evidence4 = String(row[7] || '').trim();

  // V2 扩展字段 (列 8-13, 可选)
  const provinceRaw = String(row[8] || '').trim();      // 省份
  const districtRaw = String(row[9] || '').trim();      // 区县
  const addressRaw = String(row[10] || '').trim();      // 详细地址
  const lngRaw = row[11];                                // 经度 (可能是数字或字符串)
  const latRaw = row[12];                                // 纬度
  const coordSystemRaw = row[13];                        // 坐标系

  // 跳过空行
  if (!cityRaw && !companyRaw) return [];
  // 跳过表头
  if (cityRaw === '城市' || companyRaw === '公司') return [];

  // 处理特殊情况: 公司名里嵌入了城市 (e.g. "Linkedin - 北京" 这种行其实公司已经把城市带在名字里)
  let actualCityRaw = cityRaw;
  let actualCompanyRaw = companyRaw;
  if (!cityRaw && companyRaw.includes(' - ')) {
    const parts = companyRaw.split(' - ');
    actualCityRaw = parts[0].trim();
    actualCompanyRaw = parts.slice(1).join(' - ').trim();
  }

  const cities = splitCities(actualCityRaw);
  const { name: companyName, raw: companyNameRaw } = cleanCompanyName(actualCompanyRaw);
  if (!companyName) return [];

  const evidenceList = [evidence1, evidence2, evidence3, evidence4].filter(e => e);
  const evidenceText = evidenceList.join(' | ');

  const fullText = `${actualCityRaw} ${companyName} ${timeRaw} ${ruleText} ${evidenceText}`;
  const workSystem = classifyWorkSystem(fullText, section);
  const weekendType = classifyWeekendType(fullText, section, workSystem);
  const riskLevel = classifyRiskLevel(workSystem, `${ruleText} ${evidenceText}`);
  const confidence = classifyConfidence(section, ruleText, evidenceList);
  const eventDate = excelDateToString(timeRaw);

  // issue #8: 生成分类依据 (供公司详情页展示)
  const classificationBasis = buildClassificationBasis(
    fullText,
    section,
    workSystem,
    weekendType,
    riskLevel,
    `${ruleText} ${evidenceText}`,
  );

  // ===== V2: 解析公司级经纬度 =====
  const companyLng = parseCoordinate(lngRaw);
  const companyLat = parseCoordinate(latRaw);
  const hasValidCompanyCoord = companyLng !== null && companyLat !== null && isValidChinaCoordinate(companyLng, companyLat);
  const coordSystem = parseCoordSystem(coordSystemRaw);
  const geoSource: GeoSource = hasValidCompanyCoord ? 'excel' : 'unknown';

  // ===== 为每个城市生成一条记录 (multi-city 展开) =====
  // 注意: 如果记录有公司经纬度, 不按多城市展开 (经纬度是单一位置)
  if (hasValidCompanyCoord) {
    // 用公司经纬度, 城市字段用于显示 (从 cityRaw 取第一个城市)
    const primaryCity = cities[0] || '';
    const center = primaryCity ? findCityCenter(primaryCity) : null;
    return [{
      id: `rec_${String(rowIndex).padStart(6, '0')}`,
      company_name: companyName,
      company_name_raw: companyNameRaw,
      city: center?.city || primaryCity,
      city_raw: actualCityRaw,
      city_list: cities,
      province: provinceRaw || center?.province || '',
      district: districtRaw,
      address: addressRaw,
      geo_level: 'coordinate',
      lng: companyLng,
      lat: companyLat,
      coord_system: coordSystem,
      geo_source: geoSource,
      section,
      work_system: workSystem,
      weekend_type: weekendType,
      risk_level: riskLevel,
      classification_basis: classificationBasis,
      time_raw: timeRaw,
      event_date: eventDate,
      rule_text: ruleText,
      evidence_text: evidenceText,
      evidence_list: evidenceList,
      source_type: 'uploaded_excel',
      source_name: sourceName,
      source_sheet: sheetName,
      source_row: rowIndex,
      confidence,
      updated_at: new Date().toISOString(),
    }];
  }

  // 无公司经纬度: 按城市展开 (多城市每个生成一条, 用城市中心坐标)
  if (cities.length === 0) {
    return [{
      id: `rec_${String(rowIndex).padStart(6, '0')}`,
      company_name: companyName,
      company_name_raw: companyNameRaw,
      city: '',
      city_raw: actualCityRaw,
      city_list: [],
      province: provinceRaw,
      district: districtRaw,
      address: addressRaw,
      geo_level: inferGeoLevel(false, addressRaw, districtRaw, false),
      lng: null,
      lat: null,
      coord_system: coordSystem,
      geo_source: 'unknown',
      section,
      work_system: workSystem,
      weekend_type: weekendType,
      risk_level: riskLevel,
      classification_basis: classificationBasis,
      time_raw: timeRaw,
      event_date: eventDate,
      rule_text: ruleText,
      evidence_text: evidenceText,
      evidence_list: evidenceList,
      source_type: 'uploaded_excel',
      source_name: sourceName,
      source_sheet: sheetName,
      source_row: rowIndex,
      confidence,
      updated_at: new Date().toISOString(),
    }];
  }

  return cities.map((city, idx) => {
    const center = findCityCenter(city);
    const hasCityCoord = center !== null;
    const finalLng = center?.lng ?? null;
    const finalLat = center?.lat ?? null;
    return {
      id: `rec_${String(rowIndex).padStart(6, '0')}_${idx}`,
      company_name: companyName,
      company_name_raw: companyNameRaw,
      city: center?.city || city,
      city_raw: actualCityRaw,
      city_list: cities,
      province: provinceRaw || center?.province || '',
      district: districtRaw,
      address: addressRaw,
      geo_level: inferGeoLevel(false, addressRaw, districtRaw, hasCityCoord),
      lng: finalLng,
      lat: finalLat,
      coord_system: coordSystem,
      geo_source: hasCityCoord ? 'geocoded' as const : 'unknown' as const,
      section,
      work_system: workSystem,
      weekend_type: weekendType,
      risk_level: riskLevel,
      classification_basis: classificationBasis,
      time_raw: timeRaw,
      event_date: eventDate,
      rule_text: ruleText,
      evidence_text: evidenceText,
      evidence_list: evidenceList,
      source_type: 'uploaded_excel',
      source_name: sourceName,
      source_sheet: sheetName,
      source_row: rowIndex,
      confidence,
      updated_at: new Date().toISOString(),
    };
  });
}

/**
 * 解析整个 sheet 数据 (从 XLSX.utils.sheet_to_json 的二维数组)
 */
export function parseSheetRows(
  rows: any[][],
  sourceName: string,
  sheetName: string,
): CompanyRecord[] {
  const records: CompanyRecord[] = [];
  let currentSection: SectionTitle | null = null;

  rows.forEach((row, i) => {
    const col0 = String(row[0] || '').trim();

    // 检测 section 切换 (兼容多种原始标题写法)
    if (col0.includes('955') && (col0.includes('正常') || col0.includes('名单') || col0.includes('记录'))) {
      currentSection = '955';
      return;
    }
    if (col0.includes('965') && (col0.includes('较差') || col0.includes('名单') || col0.includes('记录'))) {
      currentSection = '965';
      return;
    }
    if (col0.includes('996') && (col0.includes('黑名单') || col0.includes('极差') || col0.includes('高强度') || col0.includes('记录'))) {
      currentSection = '996';
      return;
    }

    // 表头行跳过
    if (col0 === '城市') return;
    // 空行跳过
    if (!row.some(c => String(c || '').trim())) return;
    if (!currentSection) return;

    const newRecords = buildCompanyRecord(row, i + 1, currentSection, sourceName, sheetName);
    records.push(...newRecords);
  });

  return records;
}
