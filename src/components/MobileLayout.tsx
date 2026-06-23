'use client';

// ============================================================
// 移动端布局: 顶部紧凑 + 横向滚动统计 + 地图主区 + 底部抽屉
// ============================================================
import { useState } from 'react';
import { Filter, SlidersHorizontal, MapPin, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FilterPanel } from './FilterPanel';
import { CityDetail } from './CityDetail';
import { StatsPanel } from './StatsPanel';
import { MapView } from './MapView';
import { Legend } from './Legend';
import { SearchBar } from './SearchBar';
import { useMapStore } from '@/store/useMapStore';

export function MobileLayout() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const selectedCity = useMapStore(s => s.selectedCity);
  const selectedCompany = useMapStore(s => s.selectedCompany);
  const selectCity = useMapStore(s => s.selectCity);
  const selectCompany = useMapStore(s => s.selectCompany);
  const filter = useMapStore(s => s.filter);

  const activeFilterCount =
    filter.cities.length + filter.workSystems.length + filter.weekendTypes.length +
    filter.riskLevels.length + filter.confidences.length;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* 顶部搜索栏 + 筛选按钮 */}
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
      </header>

      {/* 横向滚动统计卡片 */}
      <div className="bg-gradient-to-r from-slate-50 via-emerald-50/40 to-slate-50 border-b border-slate-200 overflow-x-auto shrink-0">
        <div className="inline-flex min-w-max">
          <StatsPanel />
        </div>
      </div>

      {/* 地图主区域 (剩余高度) */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <Legend />
        <MapView />
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
