'use client';

// ============================================================
// 中国公司作息地图 - 首页 (响应式: 桌面 / 移动自动切换)
// ============================================================
import { useEffect } from 'react';
import { MapView } from '@/components/MapView';
import { CompanyMapView } from '@/components/CompanyMapView';
import { Deck25DMapView } from '@/components/Deck25DMapView';
import { MapModeSwitcher } from '@/components/MapModeSwitcher';
import { FilterPanel } from '@/components/FilterPanel';
import { SearchBar } from '@/components/SearchBar';
import { StatsPanel } from '@/components/StatsPanel';
import { CityDetail } from '@/components/CityDetail';
import { Legend } from '@/components/Legend';
import { UploadExcel } from '@/components/UploadExcel';
import { ExportButton } from '@/components/ExportButton';
import { DownloadSampleButton } from '@/components/DownloadSampleButton';
import { DataQualityPanel } from '@/components/DataQualityPanel';
import { MobileLayout } from '@/components/MobileLayout';
import { useMapStore } from '@/store/useMapStore';
import { useIsMobile } from '@/hooks/use-media-query';
import { useDatasetVersionPoller } from '@/hooks/use-dataset-version-poller';
import { parseExcelBuffer } from '@/lib/parse-excel';
import { Github, Info, ShieldAlert, MapPin, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** V2.1: 格式化 ISO 时间为 "MM-DD HH:mm" 紧凑显示 (用于顶部数据源区域) */
function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${M}-${D} ${h}:${m}`;
  } catch {
    return '';
  }
}

export default function Home() {
  const isMobile = useIsMobile();
  const loading = useMapStore(s => s.loading);
  const error = useMapStore(s => s.error);
  const setRecords = useMapStore(s => s.setRecords);
  const loadDatasetFromApi = useMapStore(s => s.loadDatasetFromApi);
  const setError = useMapStore(s => s.setError);
  const setLoading = useMapStore(s => s.setLoading);
  const dataSource = useMapStore(s => s.dataSource);
  const datasetVersion = useMapStore(s => s.datasetVersion);
  const datasetCreatedAt = useMapStore(s => s.datasetCreatedAt);
  const dataMode = useMapStore(s => s.dataMode);
  const globalStats = useMapStore(s => s.globalStats);
  const citySummaries = useMapStore(s => s.citySummaries);
  const mapMode = useMapStore(s => s.mapMode);

  // 启动公共数据版本轮询 (仅在 API 模式下生效, 内部自管理)
  useDatasetVersionPoller();

  // 启动时加载公共数据: 优先 API, fallback 到 public/data 预置示例
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);

        // ===== 优先尝试 API: GET /api/dataset/latest =====
        try {
          const apiRes = await fetch('/api/dataset/latest', { cache: 'no-store' });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (!cancelled && data && Array.isArray(data.records) && data.records.length > 0) {
              loadDatasetFromApi({
                version: data.version,
                file_name: data.file_name,
                records: data.records,
                city_summary: data.city_summary,
                created_at: data.created_at,
              });
              return;
            }
          }
          // 404 / 503 都正常, fallback 到预置数据
        } catch (apiErr) {
          console.warn('[loadData] API failed, falling back to static data:', apiErr);
        }

        // ===== Fallback: public/data 预置示例 =====
        const res = await fetch('/data/normalized_companies.json');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setRecords(data, '中国公司作息情况.xlsx (预置示例)');
            useMapStore.setState({ dataMode: 'fallback' });
            return;
          }
        }
        const excelRes = await fetch('/data/中国公司作息情况.example.xlsx');
        if (!excelRes.ok) throw new Error(`无法加载示例数据 (HTTP ${excelRes.status})`);
        const buffer = await excelRes.arrayBuffer();
        const records = parseExcelBuffer(buffer, '中国公司作息情况.xlsx');
        if (cancelled) return;
        if (records.length === 0) throw new Error('示例数据为空');
        setRecords(records, '中国公司作息情况.xlsx (预置示例)');
        useMapStore.setState({ dataMode: 'fallback' });
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load data:', e);
        setError(e instanceof Error ? e.message : '加载数据失败');
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [setRecords, loadDatasetFromApi, setError, setLoading]);

  // 加载提示 (避免布局闪烁, 在两种布局下都显示)
  if (loading && !error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <div className="text-slate-500 text-sm">正在加载公共作息数据...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 max-w-md px-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="text-red-700 text-sm font-medium">数据加载失败</div>
          <div className="text-slate-500 text-xs text-center">{error}</div>
        </div>
      </div>
    );
  }

  // 移动端布局
  if (isMobile) {
    return <MobileLayout />;
  }

  // 桌面端布局
  return (
    <main className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-base leading-tight">中国公司作息地图</div>
            <div className="text-[10px] text-slate-400 leading-tight">WorkLifeMap China · V2 城市级 + 公司点位</div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          {/* V2.1: 顶部数据源信息 (版本/文件名/记录数/城市数/更新时间) */}
          {dataSource && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 max-w-[420px]">
              {datasetVersion !== null && (
                <span className="font-semibold text-emerald-600 shrink-0">v{datasetVersion}</span>
              )}
              <span className="truncate" title={dataSource}>, {dataSource}</span>
              {globalStats && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="shrink-0">{globalStats.totalRecords} 条</span>
                  <span className="text-slate-300">·</span>
                  <span className="shrink-0">{citySummaries.length} 城市</span>
                </>
              )}
              {datasetCreatedAt && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="shrink-0 text-slate-400" title={datasetCreatedAt}>
                    {formatDateTime(datasetCreatedAt)}
                  </span>
                </>
              )}
              {dataMode === 'fallback' && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] shrink-0">预置</span>
              )}
            </div>
          )}
          <UploadExcel />
          <DownloadSampleButton
            label="下载样例"
            variant="outline"
            size="sm"
            className="bg-white/80 backdrop-blur-sm"
          />
          <ExportButton />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
                <Info className="w-3.5 h-3.5 mr-1" />关于
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>关于本项目</DialogTitle>
                <DialogDescription>
                  开源的中国公司作息数据可视化工具
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm text-slate-600 space-y-3 leading-relaxed">
                <p>
                  本项目接收用户上传的 955/965/996 公司作息数据 (Excel: .xlsx / .xls),
                  自动清洗、分类、工作强度评级后, 在中国地图上以城市为单位展示
                  公司作息情况。
                </p>
                <div className="bg-slate-50 rounded-md p-3 text-xs space-y-1">
                  <div className="font-semibold text-slate-700">V1 已实现</div>
                  <div>· Excel 导入与多区域识别</div>
                  <div>· 城市级聚合与强度评分</div>
                  <div>· 工作制度/周末类型自动分类</div>
                  <div>· 搜索、筛选、多格式导出</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                  <strong>免责声明:</strong> 本项目数据来自用户上传或公开整理,
                  仅供参考, 不代表公司官方结论, 也不构成对任何公司的法律判定。
                  同一公司不同城市、部门、岗位作息可能存在显著差异,
                  请以劳动合同和实际工作情况为准。
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* 顶部统计 - 桌面端用渐变背景 */}
      <div className="bg-gradient-to-r from-slate-50 via-emerald-50/40 to-slate-50 border-b border-slate-200 shrink-0">
        <StatsPanel />
      </div>

      {/* 主区域: 左筛选 + 中地图 + 右详情 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧筛选栏 + V2.5 数据质量面板 */}
        <aside className="w-[260px] shrink-0 border-r border-slate-200 bg-white hidden md:block flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <FilterPanel />
          </div>
          <div className="p-3 border-t border-slate-100 shrink-0">
            <DataQualityPanel />
          </div>
        </aside>

        {/* 中间地图 */}
        <section className="flex-1 relative overflow-hidden">
          {mapMode !== '2.5d' && <Legend />}
          <MapModeSwitcher />
          {mapMode === '2.5d' ? (
            <Deck25DMapView />
          ) : mapMode === 'company' ? (
            <CompanyMapView />
          ) : (
            <MapView />
          )}
        </section>

        {/* 右侧详情 */}
        <aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white hidden lg:block">
          <CityDetail />
        </aside>
      </div>

      {/* 底部免责声明 */}
      <footer className="bg-slate-800 text-slate-300 px-4 py-2 text-[11px] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
          <span>
            数据来自用户上传或公开资料整理, 仅供参考, 不代表公司官方结论。请以劳动合同和公司正式制度为准。
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-400 shrink-0">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <Github className="w-3 h-3" />开源项目
          </a>
          <span>·</span>
          <span>V2.0 城市级 + 公司点位</span>
        </div>
      </footer>
    </main>
  );
}
