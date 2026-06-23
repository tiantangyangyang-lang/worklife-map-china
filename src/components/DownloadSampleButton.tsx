'use client';

// ============================================================
// 下载 Excel 样例文件 (供桌面 / 移动端 / 上传弹窗 / 错误提示共用)
// ============================================================
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** 样例文件的公开访问 URL (Next.js 静态资源) */
export const SAMPLE_EXCEL_URL = '/data/中国公司作息情况.example.xlsx';
/** 样例文件的下载文件名 */
export const SAMPLE_EXCEL_FILENAME = '中国公司作息情况.example.xlsx';

interface DownloadSampleButtonProps {
  /** 按钮文案, 默认"下载样例" */
  label?: string;
  /** 按钮变体 */
  variant?: 'outline' | 'ghost' | 'default' | 'secondary' | 'destructive' | 'link';
  /** 按钮尺寸 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否满宽 (移动端用) */
  fullWidth?: boolean;
  /** 自定义 className */
  className?: string;
  /** 是否在按钮下方显示提示文案 (上传弹窗用) */
  hint?: boolean;
}

/**
 * 下载样例 Excel 按钮
 *
 * 通过 fetch 拿到文件 Blob 再触发下载, 保证文件名是中文且不依赖浏览器对 URL 的处理。
 * fetch 失败时回退到 <a download> 直接触发。
 */
export function DownloadSampleButton({
  label = '下载样例',
  variant = 'outline',
  size = 'sm',
  showIcon = true,
  fullWidth = false,
  className = '',
  hint = false,
}: DownloadSampleButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(SAMPLE_EXCEL_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = SAMPLE_EXCEL_FILENAME;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('样例文件已开始下载');
    } catch (e) {
      console.error('Download sample failed:', e);
      // 回退: 直接用 a 标签触发 (浏览器会按 URL 路径下载)
      const a = document.createElement('a');
      a.href = SAMPLE_EXCEL_URL;
      a.download = SAMPLE_EXCEL_FILENAME;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('样例文件已打开, 请右键另存为');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={loading}
        className={`${fullWidth ? 'w-full' : ''} ${className}`.trim()}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          showIcon && <Download className="w-3.5 h-3.5 mr-1.5" />
        )}
        {label}
      </Button>
      {hint && (
        <div className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1">
          <span className="text-emerald-500 shrink-0">💡</span>
          <span>建议先按样例格式整理后再上传, 可大幅提高识别准确率。</span>
        </div>
      )}
    </>
  );
}
