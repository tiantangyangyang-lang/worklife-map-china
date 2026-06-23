'use client';

// ============================================================
// 上传 Excel 组件 (V3): 浏览器端解析 → 立即导入 → 地图实时更新
//
// 设计变更 (相对 V2):
//   - 不再有"解析报告 + 用户确认"中间步骤
//   - parseExcelFile 成功返回 records 后, 立即 resetFilter() + setRecords()
//   - 关闭弹窗, toast 提示"已导入 xxx 条作息记录, 地图已实时更新"
//   - records.length === 0 时提示用户下载样例按格式整理
// ============================================================
import { useRef, useState } from 'react';
import { UploadCloud, Loader2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/store/useMapStore';
import { parseExcelFile } from '@/lib/parse-excel';
import { DownloadSampleButton, SAMPLE_EXCEL_URL, SAMPLE_EXCEL_FILENAME } from '@/components/DownloadSampleButton';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Stage = 'idle' | 'parsing';

interface UploadExcelProps {
  /** 可选: 受控模式 (移动端"更多"菜单需要外部触发) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 可选: 隐藏默认触发按钮 (受控模式下使用) */
  hideTrigger?: boolean;
}

/** 触发样例文件下载 (toast action 回调用) */
function triggerSampleDownload() {
  const a = document.createElement('a');
  a.href = SAMPLE_EXCEL_URL;
  a.download = SAMPLE_EXCEL_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function UploadExcel({ open: controlledOpen, onOpenChange, hideTrigger }: UploadExcelProps = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const setRecords = useMapStore(s => s.setRecords);
  const resetFilter = useMapStore(s => s.resetFilter);

  // 受控 / 非受控 open 状态
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled && onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const reset = () => {
    setStage('idle');
  };

  const handleFile = async (file: File) => {
    setStage('parsing');
    try {
      const records = await parseExcelFile(file);

      if (records.length === 0) {
        // issue #5: 空数据提示用户下载样例
        toast.error('未识别到有效数据。请下载样例文件, 按样例格式整理后再上传。', {
          duration: 6000,
          action: {
            label: '下载样例',
            onClick: triggerSampleDownload,
          },
        });
        reset();
        return;
      }

      // issue #1-3, #6: 解析成功后立即导入, 不再要求用户确认
      resetFilter();
      setRecords(records, file.name);

      // 关闭弹窗 + 重置内部状态
      setOpen(false);
      setTimeout(reset, 0);

      // issue #4: toast 提示地图已实时更新
      toast.success(`已导入 ${records.length} 条作息记录, 地图已实时更新`);
    } catch (err) {
      console.error(err);
      toast.error(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`, {
        duration: 6000,
        description: `建议下载样例文件 ${SAMPLE_EXCEL_FILENAME} 按格式整理后再上传。`,
        action: {
          label: '下载样例',
          onClick: triggerSampleDownload,
        },
      });
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="bg-white/80 backdrop-blur-sm">
            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />上传数据
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            上传公司作息数据
          </DialogTitle>
          <DialogDescription>
            支持 .xlsx / .xls 格式。系统会自动识别 955 / 965 / 996 三个区域并标准化字段, 解析完成后地图立即实时更新。
          </DialogDescription>
        </DialogHeader>

        {/* ============ 拖拽 / 点击上传 ============ */}
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
                <div className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls · 解析后地图立即更新</div>
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

          {/* 醒目的下载 Excel 样例文件按钮 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex flex-col items-start gap-1">
            <DownloadSampleButton
              label="下载 Excel 样例文件"
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
              hint
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>所有解析在浏览器本地完成, 不上传服务器。解析成功后地图立即更新, 无需手动确认。</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
