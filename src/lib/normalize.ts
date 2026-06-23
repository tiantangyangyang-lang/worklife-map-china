// ============================================================
// 数据标准化: 城市清洗 / 公司名清洗 / 拆分多城市
// ============================================================
import { findCityCenter } from './city-centers';
import type { SectionTitle, CompanyRecord } from './types';
import { classifyWorkSystem, classifyWeekendType, classifyRiskLevel, classifyConfidence, excelDateToString } from './classify';

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
 * 从一行原始数据构造一条标准化 CompanyRecord
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

  // 为每个城市生成一条记录 (multi-city 展开)
  if (cities.length === 0) {
    return [{
      id: `rec_${String(rowIndex).padStart(6, '0')}`,
      company_name: companyName,
      company_name_raw: companyNameRaw,
      city: '',
      city_raw: actualCityRaw,
      city_list: [],
      province: '',
      geo_level: 'unknown',
      lng: null,
      lat: null,
      section,
      work_system: workSystem,
      weekend_type: weekendType,
      risk_level: riskLevel,
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
    return {
      id: `rec_${String(rowIndex).padStart(6, '0')}_${idx}`,
      company_name: companyName,
      company_name_raw: companyNameRaw,
      city: center?.city || city,
      city_raw: actualCityRaw,
      city_list: cities,
      province: center?.province || '',
      geo_level: center ? 'city' as const : 'unknown' as const,
      lng: center?.lng ?? null,
      lat: center?.lat ?? null,
      section,
      work_system: workSystem,
      weekend_type: weekendType,
      risk_level: riskLevel,
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
