// ============================================================
// 数据标准化: 城市清洗 / 公司名清洗 / 拆分多城市 / 公司级地理字段
// ============================================================
import { findCityCenter } from './city-centers';
import type { SectionTitle, CompanyRecord, GeoLevel, CoordSystem, GeoSource, Confidence } from './types';
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
 * V2.5: 解析地理精度字符串 → GeoLevel
 * 兼容 Excel 中手填的中文/英文写法
 */
function parseGeoLevel(val: string, fallback: GeoLevel): GeoLevel {
  const str = val.trim().toLowerCase();
  if (!str) return fallback;
  if (str.includes('coordinate') || str.includes('精确坐标') || str.includes('坐标级')) return 'coordinate';
  if (str.includes('address') || str.includes('详细地址') || str.includes('地址级')) return 'address';
  if (str.includes('district') || str.includes('区县')) return 'district';
  if (str.includes('city') || str.includes('城市')) return 'city';
  if (str.includes('unknown') || str.includes('未知') || str.includes('无法')) return 'unknown';
  return fallback;
}

/**
 * V2.5: 解析地理来源字符串 → GeoSource
 */
function parseGeoSource(val: string, fallback: GeoSource): GeoSource {
  const str = val.trim().toLowerCase();
  if (!str) return fallback;
  if (str.includes('manual') || str.includes('手填') || str.includes('手动')) return 'manual';
  if (str.includes('excel') || str.includes('表格')) return 'excel';
  if (str.includes('api')) return 'api';
  if (str.includes('geocod') || str.includes('地理编码') || str.includes('逆地理')) return 'geocoded';
  return fallback;
}

/**
 * V2.5: 根据地理精度推断 geo_confidence (地理可信度)
 *   A = 精确坐标 (coordinate)
 *   B = 地址级 (address)
 *   C = 区县级 (district)
 *   D = 城市级 (city)
 *   E = 无法定位 (unknown)
 */
function inferGeoConfidence(geoLevel: GeoLevel): Confidence {
  switch (geoLevel) {
    case 'coordinate': return 'A';
    case 'address': return 'B';
    case 'district': return 'C';
    case 'city': return 'D';
    case 'unknown': return 'E';
  }
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

  // V2.5 扩展字段 (列 8-15, 可选)
  const provinceRaw = String(row[8] || '').trim();      // 省份
  const districtRaw = String(row[9] || '').trim();      // 区县
  const addressRaw = String(row[10] || '').trim();      // 详细地址
  const lngRaw = row[11];                                // 经度 (可能是数字或字符串)
  const latRaw = row[12];                                // 纬度
  const coordSystemRaw = row[13];                        // 坐标系
  const geoLevelRaw = String(row[14] || '').trim();     // V2.5: 地理精度 (coordinate/address/district/city/unknown)
  const geoSourceRaw = String(row[15] || '').trim();    // V2.5: 地理来源 (manual/excel/api/geocoded/unknown)

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

  // V2.5: 地理精度/来源 (Excel 可手填, 否则按坐标有无推断)
  const inferredGeoLevel: GeoLevel = hasValidCompanyCoord ? 'coordinate' : inferGeoLevel(false, addressRaw, districtRaw, cities.length > 0);
  const geoLevel = parseGeoLevel(geoLevelRaw, inferredGeoLevel);
  const inferredGeoSource: GeoSource = hasValidCompanyCoord ? 'excel' : (cities.length > 0 && findCityCenter(cities[0]) ? 'geocoded' : 'unknown');
  const geoSource = parseGeoSource(geoSourceRaw, inferredGeoSource);
  const geoConfidence = inferGeoConfidence(geoLevel);

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
      geo_level: geoLevel,
      lng: companyLng,
      lat: companyLat,
      coord_system: coordSystem,
      geo_source: geoSource,
      geo_confidence: geoConfidence,
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
    const noCityGeoLevel = parseGeoLevel(geoLevelRaw, inferGeoLevel(false, addressRaw, districtRaw, false));
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
      geo_level: noCityGeoLevel,
      lng: null,
      lat: null,
      coord_system: coordSystem,
      geo_source: parseGeoSource(geoSourceRaw, 'unknown'),
      geo_confidence: inferGeoConfidence(noCityGeoLevel),
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
    const cityGeoLevel = parseGeoLevel(geoLevelRaw, inferGeoLevel(false, addressRaw, districtRaw, hasCityCoord));
    const cityGeoSource = parseGeoSource(geoSourceRaw, hasCityCoord ? 'geocoded' as const : 'unknown' as const);
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
      geo_level: cityGeoLevel,
      lng: finalLng,
      lat: finalLat,
      coord_system: coordSystem,
      geo_source: cityGeoSource,
      geo_confidence: inferGeoConfidence(cityGeoLevel),
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
 * V2.5: 检测是否为"标准化明细表"格式
 *
 * 明细表特征: 第一行是表头, 含"公司"列且不含 955/965/996 区域标题
 * 表头列示例: 公司 | 城市 | 省份 | 区县 | 详细地址 | 经度 | 纬度 | 坐标系 |
 *            工作制度 | 周末类型 | 时间 | 规则 | 证据 | 强度 | 可信度 | ...
 *
 * 与三段式格式区别: 三段式有 "955...名单" / "965...名单" / "996...记录" 区域标题行
 */
function isDetailTableFormat(rows: any[][]): boolean {
  if (rows.length === 0) return false;
  const header = rows[0];
  if (!header || header.length < 2) return false;
  const headerStr = header.map(c => String(c || '').trim()).join('|').toLowerCase();
  // 必须含"公司"列
  if (!headerStr.includes('公司') && !headerStr.includes('company')) return false;
  // 不能是三段式 (三段式第一行是区域标题, 不像表头)
  if (headerStr.includes('955') && headerStr.includes('名单')) return false;
  if (headerStr.includes('965') && headerStr.includes('名单')) return false;
  if (headerStr.includes('996') && (headerStr.includes('记录') || headerStr.includes('高强度'))) return false;
  // 明细表表头应含至少 3 个已知字段
  const knownFields = ['公司', '城市', '省份', '区县', '地址', '经度', '纬度', '坐标系',
                       '工作制度', '周末', '时间', '规则', '证据', '强度', '可信度',
                       'company', 'city', 'province', 'district', 'address', 'lng', 'lat'];
  let matchCount = 0;
  for (const f of knownFields) {
    if (headerStr.includes(f.toLowerCase())) matchCount++;
  }
  return matchCount >= 3;
}

/**
 * V2.5: 按表头列名建立 "列名 → 列索引" 映射 (大小写不敏感, 中英文兼容)
 */
function buildHeaderMap(header: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((cell, idx) => {
    const name = String(cell || '').trim().toLowerCase();
    if (!name) return;
    // 记录所有可能的别名
    const aliases: Record<string, string[]> = {
      company: ['公司', '公司名', '公司名称', 'company', 'company_name'],
      city: ['城市', 'city'],
      province: ['省份', '省', 'province'],
      district: ['区县', '区', 'district'],
      address: ['详细地址', '地址', 'address'],
      lng: ['经度', 'lng', 'lon', 'longitude'],
      lat: ['纬度', 'lat', 'latitude'],
      coord_system: ['坐标系', 'coord_system', 'coordsystem'],
      geo_level: ['地理精度', 'geo_level', 'geolevel'],
      geo_source: ['地理来源', 'geo_source', 'geosource'],
      work_system: ['工作制度', '制度', 'work_system', 'worksystem'],
      weekend_type: ['周末类型', '周末', 'weekend_type', 'weekendtype'],
      time: ['时间', 'time', 'date'],
      rule: ['规则', 'rule', '规则描述'],
      evidence: ['证据', 'evidence'],
      section: ['区域', 'section', '数据区域'],
      risk_level: ['强度', '强度等级', 'risk_level', 'intensity'],
      confidence: ['可信度', 'confidence'],
    };
    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(name) && !(key in map)) {
        map[key] = idx;
      }
    }
  });
  return map;
}

/**
 * V2.5: 解析"标准化明细表"格式 (一行一条作息记录)
 *
 * 表头映射后, 每行直接构造一条 CompanyRecord, 不做三段式区域识别。
 * section 字段: 优先从"区域"列读取, 否则按 work_system 推断 (955→955, 965→965, 996/997/007→996)。
 */
function parseDetailTable(
  rows: any[][],
  sourceName: string,
  sheetName: string,
): CompanyRecord[] {
  if (rows.length < 2) return [];
  const headerMap = buildHeaderMap(rows[0]);
  const records: CompanyRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // 空行跳过
    if (!row.some(c => String(c || '').trim())) continue;

    const get = (key: string): string => {
      const idx = headerMap[key];
      if (idx === undefined) return '';
      return String(row[idx] || '').trim();
    };
    const getNum = (key: string): number | null => {
      const idx = headerMap[key];
      if (idx === undefined) return null;
      return parseCoordinate(row[idx]);
    };

    const companyName = get('company');
    if (!companyName) continue;

    const cityRaw = get('city');
    const provinceRaw = get('province');
    const districtRaw = get('district');
    const addressRaw = get('address');
    const lng = getNum('lng');
    const lat = getNum('lat');
    const coordSystemRaw = headerMap['coord_system'] !== undefined ? row[headerMap['coord_system']] : '';
    const workSystemRaw = get('work_system');
    const weekendTypeRaw = get('weekend_type');
    const timeRaw = get('time');
    const ruleText = get('rule');
    const evidenceRaw = get('evidence');
    const sectionRaw = get('section');

    // 经纬度校验
    const hasValidCoord = lng !== null && lat !== null && isValidChinaCoordinate(lng, lat);
    const coordSystem = parseCoordSystem(coordSystemRaw);

    // work_system: 优先用 Excel 列值, 否则按 ruleText 分类
    const fullText = `${cityRaw} ${companyName} ${timeRaw} ${ruleText} ${evidenceRaw}`;
    let workSystem = workSystemRaw as any;
    if (!workSystem) {
      // 按 section 推断 section, 再按 section 推断 workSystem
      const sec = (sectionRaw as SectionTitle) || '996';
      workSystem = classifyWorkSystem(fullText, sec);
    }

    // section: 优先用 Excel 列值, 否则按 work_system 推断
    let section: SectionTitle;
    if (sectionRaw === '955' || sectionRaw === '965' || sectionRaw === '996') {
      section = sectionRaw;
    } else if (workSystem === '955') {
      section = '955';
    } else if (workSystem === '965' || workSystem === '995') {
      section = '965';
    } else {
      section = '996';
    }

    const weekendType = weekendTypeRaw as any || classifyWeekendType(fullText, section, workSystem);
    const riskLevel = classifyRiskLevel(workSystem, `${ruleText} ${evidenceRaw}`);
    const evidenceList = evidenceRaw ? evidenceRaw.split(/[|｜;；]/).map(s => s.trim()).filter(Boolean) : [];
    const evidenceText = evidenceList.join(' | ');
    const confidence = classifyConfidence(section, ruleText, evidenceList);
    const eventDate = excelDateToString(timeRaw);
    const classificationBasis = buildClassificationBasis(fullText, section, workSystem, weekendType, riskLevel, `${ruleText} ${evidenceText}`);

    // 地理精度/来源
    const inferredGeoLevel: GeoLevel = hasValidCoord ? 'coordinate' : inferGeoLevel(false, addressRaw, districtRaw, !!cityRaw);
    const geoLevel = parseGeoLevel(get('geo_level'), inferredGeoLevel);
    const inferredGeoSource: GeoSource = hasValidCoord ? 'excel' : (cityRaw && findCityCenter(cityRaw) ? 'geocoded' : 'unknown');
    const geoSource = parseGeoSource(get('geo_source'), inferredGeoSource);
    const geoConfidence = inferGeoConfidence(geoLevel);

    // 城市处理
    const cities = splitCities(cityRaw);
    const primaryCity = cities[0] || cityRaw;
    const center = primaryCity ? findCityCenter(primaryCity) : null;

    records.push({
      id: `rec_${String(i).padStart(6, '0')}`,
      company_name: companyName,
      company_name_raw: companyName,
      city: center?.city || primaryCity,
      city_raw: cityRaw,
      city_list: cities,
      province: provinceRaw || center?.province || '',
      district: districtRaw,
      address: addressRaw,
      geo_level: geoLevel,
      lng: hasValidCoord ? lng : (center?.lng ?? null),
      lat: hasValidCoord ? lat : (center?.lat ?? null),
      coord_system: coordSystem,
      geo_source: geoSource,
      geo_confidence: geoConfidence,
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
      source_row: i + 1,
      confidence,
      updated_at: new Date().toISOString(),
    });
  }

  return records;
}

/**
 * 解析整个 sheet 数据 (从 XLSX.utils.sheet_to_json 的二维数组)
 *
 * V2.5: 自动识别两种格式:
 *   A. 三段式格式 (955/965/996 区域标题 + 数据行) — 原有逻辑
 *   B. 标准化明细表格式 (表头 + 一行一条记录) — V2.5 新增
 */
export function parseSheetRows(
  rows: any[][],
  sourceName: string,
  sheetName: string,
): CompanyRecord[] {
  // V2.5: 优先检测明细表格式
  if (isDetailTableFormat(rows)) {
    return parseDetailTable(rows, sourceName, sheetName);
  }

  // 三段式格式 (原有逻辑)
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
