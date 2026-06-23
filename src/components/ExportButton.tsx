'use client';

// ============================================================
// 导出按钮: 所有格式都支持"全量"和"当前筛选"两个版本
// ============================================================
import { useState } from 'react';
import { Download, FileJson, Map, FileText, Loader2, Database, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/store/useMapStore';
import { buildCitySummary, buildGeoJSON } from '@/lib/aggregate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type ExportType = 'normalized' | 'city' | 'geojson' | 'csv';

/** 共享导出逻辑, 桌面 DropdownMenu 和移动端 Sheet 都用这个 */
export function useExportRecords() {
  const [loading, setLoading] = useState<string | null>(null);
  const allRecords = useMapStore(s => s.allRecords);
  const filteredRecords = useMapStore(s => s.filteredRecords);

  const doExport = (type: ExportType, useFiltered: boolean) => {
    const key = `${type}-${useFiltered ? 'filtered' : 'all'}`;
    setLoading(key);
    try {
      const records = useFiltered ? filteredRecords : allRecords;
      const suffix = useFiltered ? '_filtered' : '';
      const dateStr = formatDate(new Date());

      if (records.length === 0) {
        toast.error('没有可导出的记录');
        return;
      }

      switch (type) {
        case 'normalized': {
          const content = JSON.stringify(records, null, 2);
          downloadBlob(content, `normalized_companies${suffix}_${dateStr}.json`, 'application/json');
          toast.success(`已导出 ${records.length} 条标准化记录 (${useFiltered ? '当前筛选' : '全量'})`);
          break;
        }
        case 'city': {
          const summaries = buildCitySummary(records);
          const content = JSON.stringify(summaries, null, 2);
          downloadBlob(content, `city_summary${suffix}_${dateStr}.json`, 'application/json');
          toast.success(`已导出 ${summaries.length} 个城市统计 (${useFiltered ? '当前筛选' : '全量'})`);
          break;
        }
        case 'geojson': {
          const summaries = buildCitySummary(records);
          const geojson = buildGeoJSON(summaries);
          const content = JSON.stringify(geojson, null, 2);
          downloadBlob(content, `map${suffix}_${dateStr}.geojson`, 'application/geo+json');
          toast.success(`已导出 ${geojson.features.length} 个城市点位 GeoJSON (${useFiltered ? '当前筛选' : '全量'})`);
          break;
        }
        case 'csv': {
          const headers = [
            'id', 'company_name', 'city', 'province', 'section', 'work_system',
            'weekend_type', 'risk_level', 'rule_text', 'evidence_text',
            'time_raw', 'event_date', 'confidence', 'source_row', 'lng', 'lat'
          ];
          const rows = records.map(r => headers.map(h => {
            const val = (r as any)[h];
            const s = String(val ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          }).join(','));
          const content = '\ufeff' + headers.join(',') + '\n' + rows.join('\n');
          downloadBlob(content, `companies${suffix}_${dateStr}.csv`, 'text/csv;charset=utf-8');
          toast.success(`已导出 ${rows.length} 行 CSV (${useFiltered ? '当前筛选' : '全量'})`);
          break;
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('导出失败');
    } finally {
      setLoading(null);
    }
  };

  return { loading, doExport, allRecords, filteredRecords };
}

/**
 * 共享导出菜单内容 (桌面 DropdownMenuContent 和移动端 Sheet 都用)
 * 调用方负责传入 loading / doExport / counts
 */
export function ExportMenuItems({
  loading,
  doExport,
  allCount,
  filteredCount,
  onItemClick,
}: {
  loading: string | null;
  doExport: (type: ExportType, useFiltered: boolean) => void;
  allCount: number;
  filteredCount: number;
  /** 点击某项后的回调 (移动端用于关闭 Sheet) */
  onItemClick?: () => void;
}) {
  const handle = (type: ExportType, useFiltered: boolean) => {
    doExport(type, useFiltered);
    onItemClick?.();
  };

  return (
    <>
      <div className="px-1 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100 mb-1">
        数据导出 (全量 / 当前筛选)
      </div>

      {/* 标准化记录 */}
      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <FileJson className="w-3 h-3" />标准化记录 JSON
      </div>
      <button
        onClick={() => handle('normalized', false)}
        className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded flex items-center justify-between"
      >
        <span>全量数据</span>
        <span className="text-[10px] text-slate-400">{allCount} 条</span>
      </button>
      <button
        onClick={() => handle('normalized', true)}
        className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded flex items-center justify-between"
      >
        <span>当前筛选</span>
        <span className="text-[10px] text-slate-400">{filteredCount} 条</span>
      </button>

      <div className="h-2" />

      {/* 城市统计 */}
      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <Database className="w-3 h-3" />城市聚合统计 JSON
      </div>
      <button onClick={() => handle('city', false)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded">全量数据</button>
      <button onClick={() => handle('city', true)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded">当前筛选</button>

      <div className="h-2" />

      {/* GeoJSON */}
      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <Globe className="w-3 h-3" />地图 GeoJSON
      </div>
      <button onClick={() => handle('geojson', false)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded">全量数据</button>
      <button onClick={() => handle('geojson', true)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded">当前筛选</button>

      <div className="h-2" />

      {/* CSV */}
      <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        <FileText className="w-3 h-3" />Excel 友好 CSV
      </div>
      <button onClick={() => handle('csv', false)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded">全量数据</button>
      <button onClick={() => handle('csv', true)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50 rounded">当前筛选</button>

      {loading && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          正在导出...
        </div>
      )}
    </>
  );
}

export function ExportButton() {
  const { loading, doExport, allRecords, filteredRecords } = useExportRecords();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="bg-white/80 backdrop-blur-sm" disabled={loading !== null}>
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          导出
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-slate-500">数据导出 (全量 / 当前筛选)</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* 标准化记录 */}
        <DropdownMenuGroup>
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <FileJson className="w-3 h-3" />标准化记录 JSON
          </div>
          <DropdownMenuItem onClick={() => doExport('normalized', false)} className="cursor-pointer">
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm">全量数据</span>
              <span className="text-[10px] text-slate-400">{allRecords.length} 条</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport('normalized', true)} className="cursor-pointer">
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm">当前筛选</span>
              <span className="text-[10px] text-slate-400">{filteredRecords.length} 条</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* 城市统计 */}
        <DropdownMenuGroup>
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Database className="w-3 h-3" />城市聚合统计 JSON
          </div>
          <DropdownMenuItem onClick={() => doExport('city', false)} className="cursor-pointer">
            <span className="text-sm">全量数据</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport('city', true)} className="cursor-pointer">
            <span className="text-sm">当前筛选</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* GeoJSON */}
        <DropdownMenuGroup>
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Globe className="w-3 h-3" />地图 GeoJSON
          </div>
          <DropdownMenuItem onClick={() => doExport('geojson', false)} className="cursor-pointer">
            <span className="text-sm">全量数据</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport('geojson', true)} className="cursor-pointer">
            <span className="text-sm">当前筛选</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* CSV */}
        <DropdownMenuGroup>
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3" />Excel 友好 CSV
          </div>
          <DropdownMenuItem onClick={() => doExport('csv', false)} className="cursor-pointer">
            <span className="text-sm">全量数据</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport('csv', true)} className="cursor-pointer">
            <span className="text-sm">当前筛选</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
