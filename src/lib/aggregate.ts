// ============================================================
// 数据聚合: 按城市统计 / 生成 GeoJSON / 强度评分
// ============================================================
import type { CompanyRecord, CitySummary, GeoJSONCollection, CompanyGeoJSONCollection, RiskLevel } from './types';

/** 强度评分权重 (用于城市聚合) */
const RISK_WEIGHTS: Record<RiskLevel, number> = {
  low: 0,
  medium: 30,
  high: 65,
  very_high: 100,
  unknown: 50,
};

/**
 * 按城市聚合公司记录, 计算强度评分和统计
 */
export function buildCitySummary(records: CompanyRecord[]): CitySummary[] {
  const cityMap = new Map<string, CompanyRecord[]>();

  // 只聚合可定位的城市
  for (const rec of records) {
    if (!rec.city || rec.lng === null || rec.lat === null) continue;
    if (!cityMap.has(rec.city)) cityMap.set(rec.city, []);
    cityMap.get(rec.city)!.push(rec);
  }

  const summaries: CitySummary[] = [];

  for (const [city, recs] of cityMap.entries()) {
    const total = recs.length;
    const count_955 = recs.filter(r => r.section === '955').length;
    const count_965 = recs.filter(r => r.section === '965').length;
    const count_996 = recs.filter(r => r.section === '996').length;

    const count_low = recs.filter(r => r.risk_level === 'low').length;
    const count_medium = recs.filter(r => r.risk_level === 'medium').length;
    const count_high = recs.filter(r => r.risk_level === 'high').length;
    const count_very_high = recs.filter(r => r.risk_level === 'very_high').length;
    const count_unknown = recs.filter(r => r.risk_level === 'unknown').length;

    // 强度评分 = 加权平均
    const risk_score = Math.round(
      recs.reduce((sum, r) => sum + RISK_WEIGHTS[r.risk_level], 0) / total,
    );

    // 主导强度等级 (取最多的等级)
    const levelCount: Record<RiskLevel, number> = {
      low: count_low,
      medium: count_medium,
      high: count_high,
      very_high: count_very_high,
      unknown: count_unknown,
    };
    let risk_dominant: RiskLevel = 'unknown';
    let maxCount = 0;
    (Object.keys(levelCount) as RiskLevel[]).forEach(level => {
      if (levelCount[level] > maxCount) {
        maxCount = levelCount[level];
        risk_dominant = level;
      }
    });

    summaries.push({
      city,
      province: recs[0].province,
      total,
      count_955,
      count_965,
      count_996,
      count_high: count_high + count_very_high,
      count_very_high,
      count_low,
      count_medium,
      count_unknown,
      risk_score,
      risk_dominant,
      lng: recs[0].lng!,
      lat: recs[0].lat!,
    });
  }

  // 按总数排序
  return summaries.sort((a, b) => b.total - a.total);
}

/**
 * 生成 GeoJSON FeatureCollection (城市点位)
 *
 * V2 升级 (issue #6): 同时支持公司点位 + 城市中心 fallback
 *   - 有公司经纬度 (geo_level = 'coordinate') 的记录 → 导出公司精确坐标 Point, geo_level = 'coordinate'
 *   - 无公司经纬度但有城市中心 → 导出城市中心 Point, geo_level = 'city'
 *   - 无任何坐标 → 跳过
 */
export function buildGeoJSON(summaries: CitySummary[]): GeoJSONCollection {
  return {
    type: 'FeatureCollection',
    features: summaries.map(s => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.lng, s.lat] as [number, number],
      },
      properties: {
        city: s.city,
        province: s.province,
        total: s.total,
        risk_score: s.risk_score,
        risk_dominant: s.risk_dominant,
        count_955: s.count_955,
        count_965: s.count_965,
        count_996: s.count_996,
        geo_level: 'city', // 城市聚合模式导出的都是城市级
      },
    })),
  };
}

/**
 * 生成公司级 GeoJSON FeatureCollection (V2 公司点位地图导出)
 *
 * 每条有坐标的记录导出为一个 Point Feature:
 *   - geo_level = 'coordinate' → 公司精确坐标
 *   - geo_level = 'city'       → 城市中心 fallback
 *   - lng/lat 为 null          → 跳过
 */
export function buildCompanyGeoJSON(records: CompanyRecord[]): CompanyGeoJSONCollection {
  const features = records
    .filter(r => r.lng !== null && r.lat !== null)
    .map(r => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [r.lng as number, r.lat as number] as [number, number],
      },
      properties: {
        id: r.id,
        company_name: r.company_name,
        city: r.city,
        province: r.province,
        district: r.district,
        address: r.address,
        geo_level: r.geo_level,
        coord_system: r.coord_system,
        geo_source: r.geo_source,
        section: r.section,
        work_system: r.work_system,
        weekend_type: r.weekend_type,
        risk_level: r.risk_level,
        rule_text: r.rule_text,
        confidence: r.confidence,
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * 全局统计 (用于顶部 StatsPanel)
 */
export interface GlobalStats {
  totalRecords: number;
  totalCities: number;
  count_955: number;
  count_965: number;
  count_996: number;
  count_high_or_above: number;
  count_very_high: number;
  count_low: number;
  count_medium: number;
  count_unknown: number;
  highRiskRatio: number; // 0-100
}

export function buildGlobalStats(records: CompanyRecord[]): GlobalStats {
  const total = records.length;
  const cities = new Set(records.filter(r => r.city).map(r => r.city));
  const count_955 = records.filter(r => r.section === '955').length;
  const count_965 = records.filter(r => r.section === '965').length;
  const count_996 = records.filter(r => r.section === '996').length;
  const count_high_or_above = records.filter(r => r.risk_level === 'high' || r.risk_level === 'very_high').length;
  const count_very_high = records.filter(r => r.risk_level === 'very_high').length;
  const count_low = records.filter(r => r.risk_level === 'low').length;
  const count_medium = records.filter(r => r.risk_level === 'medium').length;
  const count_unknown = records.filter(r => r.risk_level === 'unknown').length;

  return {
    totalRecords: total,
    totalCities: cities.size,
    count_955,
    count_965,
    count_996,
    count_high_or_above,
    count_very_high,
    count_low,
    count_medium,
    count_unknown,
    highRiskRatio: total > 0 ? Math.round((count_high_or_above / total) * 100) : 0,
  };
}
