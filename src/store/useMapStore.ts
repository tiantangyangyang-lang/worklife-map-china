// ============================================================
// Zustand 全局状态管理
// ============================================================
import { create } from 'zustand';
import type { CompanyRecord, CitySummary, MapMode } from '@/lib/types';
import { buildCitySummary, buildGlobalStats, buildGlobalStatsFromCitySummary } from '@/lib/aggregate';
import type { GlobalStats } from '@/lib/aggregate';
import type { FilterState, WorkSystem, WeekendType, RiskLevel, Confidence } from '@/lib/types';

interface MapStore {
  // 数据
  allRecords: CompanyRecord[];
  filteredRecords: CompanyRecord[];
  citySummaries: CitySummary[];
  globalStats: GlobalStats | null;
  /** P1 #4: 明细 records 是否已加载。摘要先行渲染时为 false, 明细后台到位后置 true。 */
  recordsLoaded: boolean;

  // 加载状态
  loading: boolean;
  error: string | null;
  dataSource: string; // 数据来源名称
  /** 当前数据集版本号 (来自 API /api/dataset/latest), 用于轮询比较; null 表示未从 API 加载 */
  datasetVersion: number | null;
  /** 数据集更新时间 (ISO 字符串, 来自 API created_at; fallback 模式为空) */
  datasetCreatedAt: string | null;
  /** 数据来源模式: 'api' = 公共数据库 / 'fallback' = public/data 预置 */
  dataMode: 'api' | 'fallback' | 'unknown';

  // 交互状态
  selectedCity: string | null;
  selectedCompany: CompanyRecord | null;
  /** V2.5: 公司点位模式下选中的聚合簇 (同坐标的多条记录) */
  selectedCompanyCluster: CompanyRecord[] | null;
  hoveredCity: string | null;

  // 地图模式 (V2 公司点位地图)
  mapMode: MapMode; // 'city' = 城市聚合, 'company' = 公司点位

  // 筛选
  filter: FilterState;

  // Actions
  setRecords: (records: CompanyRecord[], source: string) => void;
  setMapMode: (mode: MapMode) => void;
  /**
   * P1 #4: 摘要先行加载 (只有 city_summary, 没有明细 records)。
   * 用于首屏立即渲染城市聚合图 + 统计, 明细随后由 mergeRecords 补上。
   */
  loadSummaryFromApi: (
    payload: {
      version: number;
      file_name: string;
      city_summary: CitySummary[];
      created_at?: string;
    },
    options?: { silent?: boolean }
  ) => void;
  /** P1 #4: 明细 records 后台到位后合并进 store, 解锁筛选/搜索/公司点位图。 */
  mergeRecords: (records: CompanyRecord[], options?: { silent?: boolean }) => void;
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
      created_at?: string;
    },
    options?: { silent?: boolean }
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectCity: (city: string | null) => void;
  selectCompany: (company: CompanyRecord | null) => void;
  /** V2.5: 选中一个聚合簇 (公司点位模式点击同坐标的多条记录) */
  selectCompanyCluster: (records: CompanyRecord[] | null) => void;
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
  recordsLoaded: false,
  loading: true,
  error: null,
  dataSource: '',
  datasetVersion: null,
  datasetCreatedAt: null,
  dataMode: 'unknown',
  selectedCity: null,
  selectedCompany: null,
  selectedCompanyCluster: null,
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
      recordsLoaded: true,
      loading: false,
      error: null,
      dataSource: source,
    });
  },

  setMapMode: (mode) => {
    // 切换地图模式时清空选中状态, 避免跨模式残留高亮
    set({ mapMode: mode, selectedCity: null, selectedCompany: null, selectedCompanyCluster: null });
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
      recordsLoaded: true,
      loading: false,
      error: null,
      dataSource: payload.file_name,
      datasetVersion: payload.version,
      datasetCreatedAt: payload.created_at ?? null,
      dataMode: 'api',
      // 静默更新 (轮询触发的) 不重置选中状态, 避免打断用户
      ...(silent ? {} : { selectedCity: null, selectedCompany: null }),
    });
  },

  // P1 #4: 摘要先行 —— 只用 city_summary 渲染城市图 + 统计, 不含明细 records
  loadSummaryFromApi: (payload, options) => {
    const summaries = payload.city_summary ?? [];
    const stats = buildGlobalStatsFromCitySummary(summaries);
    const silent = options?.silent ?? false;
    set({
      allRecords: [],
      filteredRecords: [],
      citySummaries: summaries,
      globalStats: stats,
      recordsLoaded: false,
      loading: false,
      error: null,
      dataSource: payload.file_name,
      datasetVersion: payload.version,
      datasetCreatedAt: payload.created_at ?? null,
      dataMode: 'api',
      ...(silent ? {} : { selectedCity: null, selectedCompany: null }),
    });
  },

  // P1 #4: 明细 records 后台到位后合并; 此后 records 成为筛选/统计的来源
  mergeRecords: (records) => {
    const { filter } = get();
    const filtered = applyFilter(records, filter);
    // 有筛选时按筛选后的明细重算; 无筛选时也用明细重算 (与服务端 city_summary 一致)
    const summaries = buildCitySummary(filtered);
    const stats = buildGlobalStats(filtered);
    set({
      allRecords: records,
      filteredRecords: filtered,
      citySummaries: summaries,
      globalStats: stats,
      recordsLoaded: true,
    });
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  selectCity: (city) => set({ selectedCity: city, selectedCompany: null, selectedCompanyCluster: null }),
  selectCompany: (company) => set({ selectedCompany: company, selectedCompanyCluster: null }),
  selectCompanyCluster: (records) => set({
    selectedCompanyCluster: records,
    // 如果簇只有一条记录, 同时设置 selectedCompany 方便详情页复用
    selectedCompany: records && records.length === 1 ? records[0] : null,
  }),
  hoverCity: (city) => set({ hoveredCity: city }),

  setFilter: (partial) => {
    const { allRecords, filter, recordsLoaded } = get();
    const newFilter = { ...filter, ...partial };
    // P1 #4: 明细还没加载完时, 只暂存筛选条件, 不动摘要视图;
    // 等 mergeRecords 到位后会自动按这个 filter 重算。
    if (!recordsLoaded) {
      set({ filter: newFilter });
      return;
    }
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
    const { allRecords, recordsLoaded } = get();
    if (!recordsLoaded) {
      set({ filter: DEFAULT_FILTER });
      return;
    }
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
    const { allRecords, filter, recordsLoaded } = get();
    if (!recordsLoaded) return;
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
