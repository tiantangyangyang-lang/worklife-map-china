'use client';

// ============================================================
// 上传 Excel 组件 (V2): 浏览器端解析 → 解析报告 → 用户确认 → 替换数据
// ============================================================
import { useRef, useState } from 'react';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMapStore } from '@/store/useMapStore';
import { parseExcelFile } from '@/lib/parse-excel';
import { buildParseReport, type ParseReport } from '@/lib/parse-report';
import { RISK_COLORS, WORK_SYSTEM_LABELS } from '@/lib/types';
import type { CompanyRecord } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Stage = 'idle' | 'parsing' | 'review' | 'done';

export function UploadExcel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [pendingRecords, setPendingRecords] = useState<CompanyRecord[]>([]);
  const [pendingReport, setPendingReport] = useState<ParseReport | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const setRecords = useMapStore(s => s.setRecords);
  const resetFilter = useMapStore(s => s.resetFilter);

  const reset = () => {
    setStage('idle');
    setPendingRecords([]);
    setPendingReport(null);
    setPendingFileName('');
  };

  const handleFile = async (file: File) => {
    setStage('parsing');
    try {
      const records = await parseExcelFile(file);
      if (records.length === 0) {
        toast.error('未在文件中识别到 955/965/996 数据, 请检查 Excel 格式');
        reset();
        return;
      }
      const report = buildParseReport(records);
      setPendingRecords(records);
      setPendingReport(report);
      setPendingFileName(file.name);
      setStage('review');
    } catch (err) {
      console.error(err);
      toast.error(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
      reset();
    }
  };

  const confirmImport = () => {
    resetFilter();
    setRecords(pendingRecords, pendingFileName);
    toast.success(`已导入 ${pendingRecords.length} 条作息记录 (来自 ${pendingFileName})`);
    setOpen(false);
    reset();
  };

  const cancelImport = () => {
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-white/80 backdrop-blur-sm">
          <UploadCloud className="w-3.5 h-3.5 mr-1.5" />上传数据
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {stage === 'review' ? '确认导入数据' : '上传公司作息数据'}
          </DialogTitle>
          <DialogDescription>
            {stage === 'review'
              ? `已解析 ${pendingFileName}, 请核对报告后确认导入`
              : '支持 .xlsx / .xls 格式。系统会自动识别 955 / 965 / 996 三个区域并标准化字段。'}
          </DialogDescription>
        </DialogHeader>

        {/* ============ 阶段 1: 拖拽上传 ============ */}
        {(stage === 'idle' || stage === 'parsing') && (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors cursor-pointer"
              onClick={() => stage === 'idle' && inputRef.current?.click()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f && stage === 'idle') handleFile(f);
              }}
              onDragOver={e => e.preventDefault()}
            >
              {stage === 'parsing' ? (
                <>
                  <Loader2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 animate-spin" />
                  <div className="text-sm text-slate-600 font-medium">解析中...</div>
                  <div className="text-xs text-slate-400 mt-1">浏览器本地解析, 不上传服务器</div>
                </>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                  <div className="text-sm text-slate-600 font-medium">点击或拖拽文件到此处</div>
                  <div className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls</div>
                </>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />

            <div className="bg-slate-50 rounded-md p-3 text-xs text-slate-600 leading-relaxed">
              <div className="font-semibold text-slate-700 mb-1">期望格式</div>
              <div>Excel 应包含一个工作表, 内含三个区域:</div>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>"955正常工作制度公司名单" → 城市 | 公司</li>
                <li>"965较差工作制度公司名单" → 城市 | 公司 | 时间 | 规则 | 证据</li>
                <li>"996...高强度作息记录" → 城市 | 公司 | 时间 | 规则 | 证据 [+ 证据2/3/4]</li>
              </ul>
              <div className="mt-2 text-slate-500">
                详细字段说明请参考 <code className="bg-white px-1 rounded">docs/EXCEL_IMPORT.md</code>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>所有解析在浏览器本地完成, 不上传服务器。</span>
            </div>
          </div>
        )}

        {/* ============ 阶段 2: 解析报告 + 预览 ============ */}
        {stage === 'review' && pendingReport && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* 报告卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-emerald-50 border border-emerald-100 rounded-md p-2.5">
                <div className="text-[10px] text-slate-500 mb-0.5">解析记录</div>
                <div className="text-xl font-bold text-emerald-700">{pendingReport.totalRecords}</div>
                <div className="text-[10px] text-slate-400">条 (含多城市展开)</div>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-md p-2.5">
                <div className="text-[10px] text-slate-500 mb-0.5">原始行数</div>
                <div className="text-xl font-bold text-sky-700">{pendingReport.rawRowCount}</div>
                <div className="text-[10px] text-slate-400">行</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-md p-2.5">
                <div className="text-[10px] text-slate-500 mb-0.5">成功定位</div>
                <div className="text-xl font-bold text-green-700">{pendingReport.citiesLocated}</div>
                <div className="text-[10px] text-slate-400">条</div>
              </div>
              <div className={`border rounded-md p-2.5 ${pendingReport.citiesUnlocated > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-[10px] text-slate-500 mb-0.5">无法定位</div>
                <div className={`text-xl font-bold ${pendingReport.citiesUnlocated > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{pendingReport.citiesUnlocated}</div>
                <div className="text-[10px] text-slate-400">条</div>
              </div>
            </div>

            {/* 区域识别 */}
            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">区域识别</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="bg-green-50 text-green-700">
                  955: {pendingReport.sectionCounts['955']} 行
                </Badge>
                <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
                  965: {pendingReport.sectionCounts['965']} 行
                </Badge>
                <Badge variant="secondary" className="bg-red-50 text-red-700">
                  996: {pendingReport.sectionCounts['996']} 行
                </Badge>
              </div>
              {pendingReport.unlocatedCities.length > 0 && (
                <div className="mt-2 text-[11px] text-amber-700">
                  ⚠ 无法定位的城市: {pendingReport.unlocatedCities.slice(0, 8).join(', ')}
                  {pendingReport.unlocatedCities.length > 8 && ` 等 ${pendingReport.unlocatedCities.length} 个`}
                </div>
              )}
            </div>

            {/* 预览表 */}
            <div className="bg-white border border-slate-200 rounded-md flex-1 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
                前 {Math.min(20, pendingReport.previewRecords.length)} 条预览
              </div>
              <ScrollArea className="flex-1 max-h-[260px]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-500">公司</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-500">城市</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-500">制度</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-500">强度</th>
                      <th className="text-left px-2 py-1.5 font-medium text-slate-500">规则摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReport.previewRecords.map(r => (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-slate-700 max-w-[120px] truncate" title={r.company_name}>
                          {r.company_name}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">{r.city || '(未定位)'}</td>
                        <td className="px-2 py-1.5 text-slate-600 text-[10px]">{r.work_system}</td>
                        <td className="px-2 py-1.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] text-white font-semibold"
                            style={{ backgroundColor: RISK_COLORS[r.risk_level].fill }}
                          >
                            {RISK_COLORS[r.risk_level].code}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-slate-500 max-w-[180px] truncate" title={r.rule_text}>
                          {r.rule_text || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>

            {/* 确认按钮 */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <Button variant="ghost" size="sm" onClick={cancelImport} className="text-slate-500">
                <X className="w-3.5 h-3.5 mr-1" />取消
              </Button>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs text-slate-500 hidden sm:inline">解析无误, 确认导入将替换当前数据</span>
                <Button size="sm" onClick={confirmImport} className="bg-emerald-600 hover:bg-emerald-700">
                  确认导入 {pendingReport.totalRecords} 条
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
