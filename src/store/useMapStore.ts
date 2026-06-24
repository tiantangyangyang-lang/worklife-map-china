// ============================================================
// Zustand 全局状态管理
// ============================================================
import { create } from 'zustand';
import type { CompanyRecord, CitySummary, MapMode } from '@/lib/types';
import { buildCitySummary, buildGlobalStats } from '@/lib/aggregate';
import type { GlobalStats } from '@/lib/aggregate';
import type { FilterState, WorkSystem, WeekendType, RiskLevel, Confidence } from '@/lib/types';

interface MapStore {
  // 数据
  allRecords: CompanyRecord[];
  filteredRecords: CompanyRecord[];
  citySummaries: CitySummary[];
  globalStats: GlobalStats | null;

  // 加载状态
  loading: boolean;
  error: string | null;
  dataSource: string; // 数据来源名称
  /** 当前数据集版本号 (来自 API /api/dataset/latest), 用于轮询比较; null 表示未从 API 加载 */
  datasetVersion: number | null;
  /** 数据来源模式: 'api' = 公共数据库 / 'fallback' = public/data 预置 */
  dataMode: 'api' | 'fallback' | 'unknown';

  // 交互状态
  selectedCity: string | null;
  selectedCompany: CompanyRecord | null;
  hoveredCity: string | null;

  // 地图模式 (V2 公司点位地图)
  mapMode: MapMode; // 'city' = 城市聚合, 'company' = 公司点位

  // 筛选
  filter: FilterState;

  // Actions
  setRecords: (records: CompanyRecord[], source: string) => void;
  setMapMode: (mode: MapMode) => void;
  /**
   * 从 API 数据集响应加载数据 (公共数据模式)
   * @param payload /api/dataset/latest 返回的数据
   * @param mode 'api' 表示来自数据库
   */
  loadDatasetFromApi: (
    payload: {
      version: number;
      file_name: string;
      records: CompanyRecord[];
      city_summary?: CitySummary[];
    },
    options?: { silent?: boolean }
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectCity: (city: string | null) => void;
  selectCompany: (company: CompanyRecord | null) => void;
  hoverCity: (city: string | null) => void;
  setFilter: (partial: Partial<FilterState>) => void;
  resetFilter: () => void;
  recompute: () => void;
}

const DEFAULT_FILTER: FilterState = {
  cities: [],
  workSystems: [],
  weekendTypes: [],
  riskLevels: [],
  confidences: [],
  keyword: '',
};

/** 应用筛选条件到记录 */
function applyFilter(records: CompanyRecord[], filter: FilterState): CompanyRecord[] {
  let result = records;

  if (filter.cities.length > 0) {
    result = result.filter(r => filter.cities.includes(r.city));
  }
  if (filter.workSystems.length > 0) {
    result = result.filter(r => filter.workSystems.includes(r.work_system));
  }
  if (filter.weekendTypes.length > 0) {
    result = result.filter(r => filter.weekendTypes.includes(r.weekend_type));
  }
  if (filter.riskLevels.length > 0) {
    result = result.filter(r => filter.riskLevels.includes(r.risk_level));
  }
  if (filter.confidences.length > 0) {
    result = result.filter(r => filter.confidences.includes(r.confidence));
  }
  if (filter.keyword.trim()) {
    const kw = filter.keyword.trim().toLowerCase();
    result = result.filter(r =>
      r.company_name.toLowerCase().includes(kw) ||
      r.city.toLowerCase().includes(kw) ||
      r.rule_text.toLowerCase().includes(kw) ||
      r.evidence_text.toLowerCase().includes(kw)
    );
  }

  return result;
}

export const useMapStore = create<MapStore>((set, get) => ({
  allRecords: [],
  filteredRecords: [],
  citySummaries: [],
  globalStats: null,
  loading: true,
  error: null,
  dataSource: '',
  datasetVersion: null,
  dataMode: 'unknown',
  selectedCity: null,
  selectedCompany: null,
  hoveredCity: null,
  mapMode: 'city',
  filter: DEFAULT_FILTER,

  setRecords: (records, source) => {
    const { filter } = get();
    const filtered = applyFilter(records, filter);
    const summaries = buildCitySummary(filtered);
    const stats = buildGlobalStats(filtered);
    set({
      allRecords: records,
      filteredRecords: filtered,
      citySummaries: summaries,
      globalStats: stats,
      loading: false,
      error: null,
      dataSource: source,
    });
  },

  setMapMode: (mode) => {
    // 切换地图模式时清空选中状态, 避免跨模式残留高亮
    set({ mapMode: mode, selectedCity: null, selectedCompany: null });
  },

  loadDatasetFromApi: (payload, options) => {
    const { filter } = get();
    const records = payload.records;
    const filtered = applyFilter(records, filter);
    // 优先用服务端预计算的 city_summary (避免重复计算); 没有则本地算
    const summaries = payload.city_summary && payload.city_summary.length > 0
      ? payload.city_summary
      : buildCitySummary(filtered);
    const stats = buildGlobalStats(filtered);
    const silent = options?.silent ?? false;
    set({
      allRecords: records,
      filteredRecords: filtered,
      citySummaries: summaries,
      globalStats: stats,
      loading: false,
      error: null,
      dataSource: payload.file_name,
      datasetVersion: payload.version,
      dataMode: 'api',
      // 静默更新 (轮询触发的) 不重置选中状态, 避免打断用户
      ...(silent ? {} : { selectedCity: null, selectedCompany: null }),
    });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  selectCity: (city) => set({ selectedCity: city, selectedCompany: null }),
  selectCompany: (company) => set({ selectedCompany: company }),
  hoverCity: (city) => set({ hoveredCity: city }),

  setFilter: (partial) => {
    const { allRecords, filter } = get();
    const newFilter = { ...filter, ...partial };
    const filtered = applyFilter(allRecords, newFilter);
    const summaries = buildCitySummary(filtered);
    const stats = buildGlobalStats(filtered);
    set({
      filter: newFilter,
      filteredRecords: filtered,
      citySummaries: summaries,
      globalStats: stats,
      selectedCity: null,
      selectedCompany: null,
    });
  },

  resetFilter: () => {
    const { allRecords } = get();
    const filtered = applyFilter(allRecords, DEFAULT_FILTER);
    const summaries = buildCitySummary(filtered);
    const stats = buildGlobalStats(filtered);
    set({
      filter: DEFAULT_FILTER,
      filteredRecords: filtered,
      citySummaries: summaries,
      globalStats: stats,
      selectedCity: null,
      selectedCompany: null,
    });
  },

  recompute: () => {
    const { allRecords, filter } = get();
    const filtered = applyFilter(allRecords, filter);
    const summaries = buildCitySummary(filtered);
    const stats = buildGlobalStats(filtered);
    set({
      filteredRecords: filtered,
      citySummaries: summaries,
      globalStats: stats,
    });
  },
}));
