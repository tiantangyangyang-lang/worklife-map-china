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

/** 坐标系 (中国常见坐标系) */
export type CoordSystem = 'wgs84' | 'gcj02' | 'bd09' | 'unknown';

/** 地理数据来源 */
export type GeoSource = 'manual' | 'excel' | 'api' | 'geocoded' | 'unknown';

/** 可信度等级 */
export type Confidence = 'A' | 'B' | 'C' | 'D' | 'E';

/** 数据来源区域 (Excel 中的三大区域) */
export type SectionTitle = '955' | '965' | '996';

/** 地图模式 */
export type MapMode = 'city' | 'company' | '2.5d';

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
  // 公司级地理字段 (V2 公司点位地图)
  district: string;          // 区县 (e.g. "海淀区")
  address: string;           // 详细地址 (e.g. "中关村大街1号")
  geo_level: GeoLevel;       // 地理精度: coordinate > address > district > city > unknown
  lng: number | null;        // 经度 (公司精确坐标 或 城市中心 fallback)
  lat: number | null;        // 纬度
  coord_system: CoordSystem; // 坐标系: wgs84 / gcj02 / bd09
  geo_source: GeoSource;     // 地理数据来源: manual / excel / api / geocoded
  geo_confidence: Confidence; // V2.5: 地理精度可信度 (A=精确坐标 B=地址级 C=区县级 D=城市级 E=无法定位)
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
  // 链接保留 (来自 Excel 单元格超链接): 公司官网 + 与 evidence_list 对齐的证据链接
  company_url?: string;          // 公司官网 (公司单元格的超链接)
  evidence_links?: string[];     // 证据链接, 与 evidence_list 同序对齐, 无链接处为 ''
  // 招聘站 / 多来源扩展字段 (V4: 明细表格式可选列, 老数据为 undefined)
  department?: string;           // 部门 (e.g. "研发中心")
  job_title?: string;            // 岗位 / 职位 (e.g. "后端工程师")
  work_begin?: string;           // 上班时间 (e.g. "09:00")
  work_end?: string;             // 下班时间 (e.g. "21:00")
  workdays?: string;             // 一周工作天数 (e.g. "5" / "6" / "大小周")
  source_platform?: string;      // 来源平台 (e.g. "BOSS直聘" / "小红书" / "51job")
  source_url?: string;           // 来源页 URL (招聘职位页 / 帖子链接, 可点击跳转)
  collected_at?: string;         // 采集时间 (ISO 字符串)
  source_type: string;
  source_name: string;
  source_sheet: string;
  source_row: number;
  confidence: Confidence;
  updated_at: string;
}

/** 城市聚合统计 (V2.5 增强) */
export interface CitySummary {
  city: string;
  province: string;
  total: number;
  total_records: number;      // V2.5: 总记录数 (同 total, 语义更清晰)
  count_955: number;
  count_965: number;
  count_996: number;
  count_high: number; // high + very_high
  count_very_high: number;
  count_low: number;
  count_medium: number;
  count_high_count: number;   // V2.5: high 级别数量 (不含 very_high)
  count_unknown: number;
  // V2.5 增强字段
  low_count: number;          // 低强度记录数 (同 count_low)
  medium_count: number;       // 中强度记录数 (同 count_medium)
  high_count: number;         // 高强度记录数 (仅 high, 不含 very_high)
  very_high_count: number;    // 极高强度记录数 (同 count_very_high)
  high_intensity_ratio: number; // 高强度占比 0-100 (high + very_high) / total
  avg_intensity_score: number;  // 平均强度评分 0-100 (同 risk_score, 语义更清晰)
  dominant_level: RiskLevel;    // V2.5: 主导强度等级 (同 risk_dominant, 语义更清晰)
  risk_score: number; // 0-100 (保留, 兼容老代码)
  risk_dominant: RiskLevel; // 保留, 兼容老代码
  lng: number;
  lat: number;
}

/** GeoJSON Feature (城市聚合模式) */
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
    geo_level?: string; // V2: 标记城市级或公司级
  };
}

/** GeoJSON Feature (公司点位模式 V2.5) */
export interface CompanyGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    company_name: string;
    city: string;
    province: string;
    district: string;
    address: string;
    geo_level: GeoLevel;
    coord_system: CoordSystem;
    geo_source: GeoSource;
    geo_confidence: Confidence;
    section: SectionTitle;
    work_system: WorkSystem;
    weekend_type: WeekendType;
    risk_level: RiskLevel;
    rule_text: string;
    confidence: Confidence;
    lng: number | null;
    lat: number | null;
    event_date: string;
  };
}

export interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/** 公司级 GeoJSON Collection (V2) */
export interface CompanyGeoJSONCollection {
  type: 'FeatureCollection';
  features: CompanyGeoJSONFeature[];
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
