// ============================================================
// Excel 解析报告: 在 setRecords 之前生成诊断信息
// 用于上传确认弹窗展示
// ============================================================
import type { CompanyRecord, SectionTitle } from './types';

export interface ParseReport {
  totalRecords: number;          // 最终标准化记录数 (含多城市展开)
  rawRowCount: number;           // Excel 原始数据行数 (排除空行/表头/区域标题)
  sectionCounts: Record<SectionTitle, number>;  // 各区域识别到的原始行数
  citiesLocated: number;         // 成功定位到城市的记录数
  citiesUnlocated: number;       // 无法定位的记录数
  unlocatedCities: string[];     // 无法定位的城市名 (去重)
  rowsSkippedEmpty: number;      // 跳过的空行数
  rowsSkippedHeader: number;     // 跳过的表头行数
  workSystemCounts: Record<string, number>;  // 工作制度分布
  intensityCounts: Record<string, number>;   // 强度等级分布
  previewRecords: CompanyRecord[];  // 前 20 条预览
}

/**
 * 生成解析报告
 */
export function buildParseReport(records: CompanyRecord[]): ParseReport {
  const sectionCounts: Record<SectionTitle, number> = { '955': 0, '965': 0, '996': 0 };
  const workSystemCounts: Record<string, number> = {};
  const intensityCounts: Record<string, number> = {};
  const unlocatedCitiesSet = new Set<string>();
  let citiesLocated = 0;
  let citiesUnlocated = 0;

  for (const r of records) {
    sectionCounts[r.section]++;
    workSystemCounts[r.work_system] = (workSystemCounts[r.work_system] || 0) + 1;
    intensityCounts[r.risk_level] = (intensityCounts[r.risk_level] || 0) + 1;

    if (r.geo_level === 'city') {
      citiesLocated++;
    } else if (r.geo_level === 'unknown') {
      citiesUnlocated++;
      if (r.city_raw) unlocatedCitiesSet.add(r.city_raw);
    }
  }

  return {
    totalRecords: records.length,
    rawRowCount: new Set(records.map(r => r.source_row)).size,
    sectionCounts,
    citiesLocated,
    citiesUnlocated,
    unlocatedCities: Array.from(unlocatedCitiesSet).sort(),
    rowsSkippedEmpty: 0,  // 这些信息需要从 parser 拿到, 简化版先填 0
    rowsSkippedHeader: 0,
    workSystemCounts,
    intensityCounts,
    previewRecords: records.slice(0, 20),
  };
}
