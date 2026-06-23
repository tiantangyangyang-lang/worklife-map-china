// ============================================================
// Zustand 全局状态管理
// ============================================================
import { create } from 'zustand';
import type { CompanyRecord, CitySummary } from '@/lib/types';
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

  // 交互状态
  selectedCity: string | null;
  selectedCompany: CompanyRecord | null;
  hoveredCity: string | null;

  // 筛选
  filter: FilterState;

  // Actions
  setRecords: (records: CompanyRecord[], source: string) => void;
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
  selectedCity: null,
  selectedCompany: null,
  hoveredCity: null,
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
