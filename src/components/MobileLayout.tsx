'use client';

// ============================================================
// 移动端布局: 顶部紧凑 + 横向滚动统计 + 地图主区 + 底部抽屉
// issue #4: 顶部增加"更多"菜单 (上传数据 / 导出数据 / 关于项目)
// ============================================================
import { useState } from 'react';
import { Filter, SlidersHorizontal, MapPin, X, ChevronDown, MoreVertical, UploadCloud, Download, Info, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FilterPanel } from './FilterPanel';
import { CityDetail } from './CityDetail';
import { StatsPanel } from './StatsPanel';
import { MapView } from './MapView';
import { CompanyMapView } from './CompanyMapView';
import { MapModeSwitcher } from './MapModeSwitcher';
import { Legend } from './Legend';
import { SearchBar } from './SearchBar';
import { UploadExcel } from './UploadExcel';
import { ExportMenuItems, useExportRecords } from './ExportButton';
import { SAMPLE_EXCEL_URL, SAMPLE_EXCEL_FILENAME } from './DownloadSampleButton';
import { useMapStore } from '@/store/useMapStore';
import { toast } from 'sonner';

export function MobileLayout() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  // issue #4: 三个独立弹窗 / 抽屉的开关
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const selectedCity = useMapStore(s => s.selectedCity);
  const selectedCompany = useMapStore(s => s.selectedCompany);
  const selectCity = useMapStore(s => s.selectCity);
  const selectCompany = useMapStore(s => s.selectCompany);
  const filter = useMapStore(s => s.filter);
  const mapMode = useMapStore(s => s.mapMode);
  // V2.1: 数据源信息
  const dataSource = useMapStore(s => s.dataSource);
  const datasetVersion = useMapStore(s => s.datasetVersion);
  const datasetCreatedAt = useMapStore(s => s.datasetCreatedAt);
  const dataMode = useMapStore(s => s.dataMode);
  const globalStats = useMapStore(s => s.globalStats);
  const citySummaries = useMapStore(s => s.citySummaries);

  /** 格式化 ISO 时间为 "MM-DD HH:mm" */
  const formatDateTime = (iso: string): string => {
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
  };

  // 导出逻辑 (共享 hook)
  const { loading: exportLoading, doExport, allRecords, filteredRecords } = useExportRecords();

  // issue #3: 下载样例 (移动端"更多"菜单用, 直接 <a> 触发避免依赖按钮组件)
  const handleDownloadSample = () => {
    const a = document.createElement('a');
    a.href = SAMPLE_EXCEL_URL;
    a.download = SAMPLE_EXCEL_FILENAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('样例文件已开始下载');
  };

  const activeFilterCount =
    filter.cities.length + filter.workSystems.length + filter.weekendTypes.length +
    filter.riskLevels.length + filter.confidences.length;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* 顶部搜索栏 + 筛选按钮 + 更多菜单 (issue #4) */}
      <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 shrink-0 z-30">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-800 text-sm hidden xs:inline">公司作息地图</span>
        </div>
        <div className="flex-1 min-w-0">
          <SearchBar />
        </div>
        {/* 筛选按钮 */}
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <Button
            variant="outline"
            size="sm"
            className="relative shrink-0 h-8 px-2"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col" aria-describedby={undefined}>
            <SheetHeader className="px-4 py-3 border-b border-slate-100">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4 text-emerald-600" />
                筛选条件
                {activeFilterCount > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{activeFilterCount}</Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <FilterPanel />
            </div>
          </SheetContent>
        </Sheet>

        {/* issue #4: 更多菜单 */}
        <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 h-8 px-2" aria-label="更多">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-slate-500">更多操作</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => { setMoreMenuOpen(false); setUploadOpen(true); }}
              className="cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 mr-2 text-emerald-600" />
              <span className="text-sm">上传数据</span>
            </DropdownMenuItem>
            {/* issue #3: 下载样例 (放在上传数据 / 导出数据之间) */}
            <DropdownMenuItem
              onClick={() => { setMoreMenuOpen(false); handleDownloadSample(); }}
              className="cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 mr-2 text-emerald-600" />
              <span className="text-sm">下载样例</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { setMoreMenuOpen(false); setExportSheetOpen(true); }}
              className="cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-2 text-emerald-600" />
              <span className="text-sm">导出数据</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { setMoreMenuOpen(false); setAboutOpen(true); }}
              className="cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 mr-2 text-emerald-600" />
              <span className="text-sm">关于项目</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* V2.1: 顶部数据源信息条 (移动端紧凑版) */}
      {dataSource && (
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-1 flex items-center gap-1.5 text-[10px] text-slate-500 overflow-x-auto shrink-0">
          {datasetVersion !== null && (
            <span className="font-semibold text-emerald-600 shrink-0">v{datasetVersion}</span>
          )}
          <span className="truncate max-w-[120px]" title={dataSource}>{dataSource}</span>
          {globalStats && (
            <>
              <span className="text-slate-300 shrink-0">·</span>
              <span className="shrink-0">{globalStats.totalRecords} 条</span>
              <span className="text-slate-300 shrink-0">·</span>
              <span className="shrink-0">{citySummaries.length} 城市</span>
            </>
          )}
          {datasetCreatedAt && (
            <>
              <span className="text-slate-300 shrink-0">·</span>
              <span className="shrink-0 text-slate-400">{formatDateTime(datasetCreatedAt)}</span>
            </>
          )}
          {dataMode === 'fallback' && (
            <span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">预置</span>
          )}
        </div>
      )}

      {/* 横向滚动统计卡片 */}
      <div className="bg-gradient-to-r from-slate-50 via-emerald-50/40 to-slate-50 border-b border-slate-200 overflow-x-auto shrink-0">
        <div className="inline-flex min-w-max">
          <StatsPanel />
        </div>
      </div>

      {/* 地图主区域 (剩余高度) */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <Legend />
        <MapModeSwitcher />
        {mapMode === 'company' ? <CompanyMapView /> : <MapView />}
      </div>

      {/* 城市详情底部抽屉 (选中城市时弹出) */}
      <Sheet
        open={selectedCity !== null || selectedCompany !== null}
        onOpenChange={(v) => { if (!v) { selectCity(null); selectCompany(null); } }}
      >
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col" aria-describedby={undefined}>
          <SheetHeader className="px-4 py-2 border-b border-slate-100 flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-sm text-slate-600">
              {selectedCompany ? '公司详情' : selectedCity ? '城市详情' : ''}
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => { selectCity(null); selectCompany(null); }}
            >
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <CityDetail />
          </div>
        </SheetContent>
      </Sheet>

      {/* issue #4: 上传数据弹窗 (复用 UploadExcel 受控模式) */}
      <UploadExcel open={uploadOpen} onOpenChange={setUploadOpen} hideTrigger />

      {/* issue #4: 导出数据 Sheet (复用 ExportMenuItems) */}
      <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
        <SheetContent side="bottom" className="p-0 flex flex-col" aria-describedby={undefined}>
          <SheetHeader className="px-4 py-3 border-b border-slate-100 flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Download className="w-4 h-4 text-emerald-600" />
              导出数据
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setExportSheetOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 pb-6">
            <ExportMenuItems
              loading={exportLoading}
              doExport={doExport}
              allCount={allRecords.length}
              filteredCount={filteredRecords.length}
              onItemClick={() => setExportSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* issue #4: 关于项目 Dialog */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
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

      {/* 可折叠免责声明 */}
      <footer className="bg-slate-800 text-slate-300 shrink-0">
        <button
          onClick={() => setDisclaimerOpen(o => !o)}
          className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] hover:bg-slate-700/50 transition-colors"
          aria-expanded={disclaimerOpen}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400">⚠</span>
            <span>数据仅供参考, 不代表公司官方结论</span>
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${disclaimerOpen ? 'rotate-180' : ''}`} />
        </button>
        {disclaimerOpen && (
          <div className="px-3 py-2 text-[11px] leading-relaxed text-slate-400 border-t border-slate-700">
            本项目数据来自用户上传或公开资料整理, 仅供参考。同一公司不同城市、部门、岗位的作息可能存在显著差异,
            请以劳动合同、公司正式制度和实际工作情况为准。
          </div>
        )}
      </footer>
    </div>
  );
}
