'use client';

// ============================================================
// 上传 Excel 组件 (V4: 公共数据发布模式)
//
// 流程:
//   1. 管理员输入密码 + 选择 .xlsx 文件
//   2. 浏览器本地解析 → records
//   3. POST /api/admin/import { password, fileName, records }
//   4. 服务端校验密码 + 保存到 Supabase (version + 1, is_active = true)
//   5. 浏览器收到新 version 后, setRecords(records, fileName) 立即更新地图
//   6. toast: 公共数据已更新, 所有用户将看到最新地图
//   7. 其它已打开页面的用户通过 10 秒轮询自动同步
// ============================================================
import { useRef, useState } from 'react';
import { UploadCloud, Loader2, AlertCircle, FileSpreadsheet, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMapStore } from '@/store/useMapStore';
import { parseExcelFile } from '@/lib/parse-excel';
import { buildCitySummary, buildGeoJSON } from '@/lib/aggregate';
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

type Stage = 'idle' | 'parsing' | 'publishing';

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
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    setSelectedFile(null);
    // 不清空密码, 方便管理员连续上传
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setStage('idle'); // 等待用户点"开始上传"按钮
  };

  /**
   * 完整上传流程: 解析 → POST /api/admin/import → 本地更新
   */
  const startUpload = async () => {
    if (!selectedFile) {
      toast.error('请先选择 Excel 文件');
      return;
    }
    if (!adminPassword.trim()) {
      toast.error('请输入管理员密码');
      return;
    }

    setStage('parsing');
    let records: Awaited<ReturnType<typeof parseExcelFile>>;
    try {
      records = await parseExcelFile(selectedFile);
    } catch (err) {
      console.error(err);
      toast.error(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`, {
        duration: 6000,
        description: `建议下载样例文件 ${SAMPLE_EXCEL_FILENAME} 按格式整理后再上传。`,
        action: { label: '下载样例', onClick: triggerSampleDownload },
      });
      setStage('idle');
      return;
    }

    if (records.length === 0) {
      toast.error('未识别到有效数据。请下载样例文件, 按样例格式整理后再上传。', {
        duration: 6000,
        action: { label: '下载样例', onClick: triggerSampleDownload },
      });
      setStage('idle');
      return;
    }

    // ===== 调用 POST /api/admin/import =====
    setStage('publishing');
    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          fileName: selectedFile.name,
          records,
        }),
      });

      if (res.status === 401) {
        toast.error('管理员密码错误', { duration: 5000 });
        setStage('idle');
        return;
      }
      if (res.status === 403) {
        toast.error('服务端未配置管理员密码 (ADMIN_UPLOAD_PASSWORD), 无法上传', { duration: 6000 });
        setStage('idle');
        return;
      }
      if (res.status === 503) {
        toast.error('服务端未配置 Supabase, 无法保存公共数据', { duration: 6000 });
        setStage('idle');
        return;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(`上传失败: ${errBody.message || `HTTP ${res.status}`}`, { duration: 6000 });
        setStage('idle');
        return;
      }

      const result = await res.json();

      // ===== 保存成功, 立即更新本地地图 =====
      resetFilter();
      setRecords(records, selectedFile.name);
      // 同步 store 的 datasetVersion / dataMode (这样轮询器知道当前版本)
      useMapStore.setState({
        datasetVersion: result.version,
        dataMode: 'api',
      });

      // 关闭弹窗
      setOpen(false);
      setTimeout(reset, 0);

      toast.success(`公共数据已更新, 所有用户将看到最新地图 (v${result.version}, ${records.length} 条)`, {
        duration: 5000,
      });
    } catch (err) {
      console.error('Upload to API failed:', err);
      toast.error(`网络错误: ${err instanceof Error ? err.message : '未知错误'}`, { duration: 6000 });
      setStage('idle');
    }
  };

  const isBusy = stage === 'parsing' || stage === 'publishing';

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
            发布公共作息数据
          </DialogTitle>
          <DialogDescription>
            管理员上传 Excel 后, 数据保存到数据库, 所有用户都会看到最新地图。支持 .xlsx / .xls 格式。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          {/* 管理员密码输入框 (issue #8) */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
            <label className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              管理员密码
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="请输入管理员密码"
                disabled={isBusy}
                className="pr-9 bg-white"
                onKeyDown={e => {
                  if (e.key === 'Enter' && selectedFile && !isBusy) {
                    e.preventDefault();
                    startUpload();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[11px] text-amber-700 leading-relaxed">
              密码错误将返回 401。普通用户上传不会直接覆盖公共数据, 如需用户投稿请后续增加审核系统。
            </div>
          </div>

          {/* 文件选择区 */}
          <div
            className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors cursor-pointer"
            onClick={() => !isBusy && inputRef.current?.click()}
            onDrop={e => {
              e.preventDefault();
              if (isBusy) return;
              const f = e.dataTransfer.files[0];
              if (f) handleFileSelected(f);
            }}
            onDragOver={e => e.preventDefault()}
          >
            {stage === 'parsing' ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 animate-spin" />
                <div className="text-sm text-slate-600 font-medium">解析中...</div>
                <div className="text-xs text-slate-400 mt-1">浏览器本地解析, 不上传原始 Excel</div>
              </>
            ) : stage === 'publishing' ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 animate-spin" />
                <div className="text-sm text-slate-600 font-medium">发布到公共数据库...</div>
                <div className="text-xs text-slate-400 mt-1">正在保存, 请稍候</div>
              </>
            ) : selectedFile ? (
              <>
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <div className="text-sm text-slate-700 font-medium break-all px-2">{selectedFile.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB · 点击更换文件
                </div>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 mx-auto mb-2 text-slate-400" />
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
              if (f) handleFileSelected(f);
              e.target.value = '';
            }}
          />

          {/* 期望格式说明 */}
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

          {/* 下载样例按钮 (issue #9 保留) */}
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
            <span>Excel 在浏览器本地解析, 仅解析后的标准化数据上传到数据库, 原始文件不上传。</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setOpen(false); reset(); }}
              disabled={isBusy}
              className="text-slate-500"
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={startUpload}
              disabled={isBusy || !selectedFile || !adminPassword.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  {stage === 'parsing' ? '解析中...' : '发布中...'}
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  发布公共数据
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
