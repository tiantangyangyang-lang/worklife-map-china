// ============================================================
// 中国公司作息地图 - 类型定义
// ============================================================

/** 工作制度类型 */
export type WorkSystem =
  | '955'
  | '965'
  | '995'
  | '996'
  | '997'
  | '007'
  | '大小周'
  | '单休'
  | '排班'
  | '加班'
  | '高强度'
  | '未知';

/** 周末休息类型 */
export type WeekendType =
  | '双休'
  | '单休'
  | '大小周'
  | '排班/轮休'
  | '未知';

/** 强度等级 (内部字段名仍为 risk_level, 但 UI 文案统一为"工作强度等级") */
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high' | 'unknown';

/** 地理精度 */
export type GeoLevel = 'city' | 'district' | 'address' | 'coordinate' | 'unknown';

/** 可信度等级 */
export type Confidence = 'A' | 'B' | 'C' | 'D' | 'E';

/** 数据来源区域 (Excel 中的三大区域) */
export type SectionTitle = '955' | '965' | '996';

/** 分类依据 (issue #8: 公司详情页展示) */
export interface ClassificationBasis {
  workSystem: {
    label: WorkSystem;
    reasons: string[];
    source: 'keyword' | 'section_fallback' | 'unknown';
  };
  weekendType: {
    label: WeekendType;
    reasons: string[];
    source: 'keyword' | 'work_system_inferred' | 'section_default' | 'unknown';
  };
  riskLevel: {
    label: RiskLevel;
    reasons: string[];
    source: 'severe_keyword' | 'work_system_mapping' | 'unknown';
  };
}

/** 标准化后的公司记录 */
export interface CompanyRecord {
  id: string;
  company_name: string;
  company_name_raw: string;
  city: string;
  city_raw: string;
  city_list: string[];
  province: string;
  geo_level: GeoLevel;
  lng: number | null;
  lat: number | null;
  section: SectionTitle;
  work_system: WorkSystem;
  weekend_type: WeekendType;
  risk_level: RiskLevel;
  classification_basis?: ClassificationBasis; // issue #8: 分类依据 (可选, 老数据可能没有)
  time_raw: string;
  event_date: string;
  rule_text: string;
  evidence_text: string;
  evidence_list: string[];
  source_type: string;
  source_name: string;
  source_sheet: string;
  source_row: number;
  confidence: Confidence;
  updated_at: string;
}

/** 城市聚合统计 */
export interface CitySummary {
  city: string;
  province: string;
  total: number;
  count_955: number;
  count_965: number;
  count_996: number;
  count_high: number; // high + very_high
  count_very_high: number;
  count_low: number;
  count_medium: number;
  count_unknown: number;
  risk_score: number; // 0-100
  risk_dominant: RiskLevel;
  lng: number;
  lat: number;
}

/** GeoJSON Feature */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    city: string;
    province: string;
    total: number;
    risk_score: number;
    risk_dominant: RiskLevel;
    count_955: number;
    count_965: number;
    count_996: number;
  };
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/** 筛选条件 */
export interface FilterState {
  cities: string[];
  workSystems: WorkSystem[];
  weekendTypes: WeekendType[];
  riskLevels: RiskLevel[];
  confidences: Confidence[];
  keyword: string;
}

/**
 * 强度等级配色 (内部字段名仍为 risk_level, 但 UI 文案使用"强度等级"中性表达)
 * label: 用户可见中文标签
 * code:  色弱用户友好的字母标记 (L/M/H/VH/?)
 */
export const RISK_COLORS: Record<RiskLevel, { fill: string; stroke: string; label: string; code: string; bg: string; text: string }> = {
  low: { fill: '#22c55e', stroke: '#15803d', label: '低强度', code: 'L', bg: 'bg-green-500', text: 'text-green-700' },
  medium: { fill: '#eab308', stroke: '#a16207', label: '中强度', code: 'M', bg: 'bg-yellow-500', text: 'text-yellow-700' },
  high: { fill: '#f97316', stroke: '#c2410c', label: '高强度', code: 'H', bg: 'bg-orange-500', text: 'text-orange-700' },
  very_high: { fill: '#dc2626', stroke: '#991b1b', label: '极高强度', code: 'VH', bg: 'bg-red-600', text: 'text-red-700' },
  unknown: { fill: '#9ca3af', stroke: '#4b5563', label: '未知', code: '?', bg: 'bg-gray-400', text: 'text-gray-600' },
};

/** 工作制度中文标签 */
export const WORK_SYSTEM_LABELS: Record<WorkSystem, string> = {
  '955': '955 (9点-5点-5天)',
  '965': '965 (9点-6点-5天)',
  '995': '995 (9点-9点-5天)',
  '996': '996 (9点-9点-6天)',
  '997': '997 (9点-9点-7天)',
  '007': '007 (全天候)',
  '大小周': '大小周',
  '单休': '单休',
  '排班': '排班/轮休',
  '加班': '加班',
  '高强度': '高强度加班',
  '未知': '未知',
};

/** 可信度说明 */
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  A: 'A - 多源验证',
  B: 'B - 规则明确且有证据',
  C: 'C - 单条记录有证据',
  D: 'D - 来源不完整',
  E: 'E - 无法验证',
};
