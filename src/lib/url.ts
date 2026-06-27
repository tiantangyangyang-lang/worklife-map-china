// ============================================================
// URL 安全校验工具 (链接会渲染为可点击 <a>, 必须防注入)
// ============================================================

/** 单个 URL 最大长度 (超长一律丢弃) */
const MAX_URL_LEN = 2000;

/**
 * 清洗并校验一个 URL:
 *   - 只接受 http:// 与 https:// 协议 (挡掉 javascript: / data: / file: 等)
 *   - 超长丢弃
 *   - 用 URL 构造器做合法性校验, 失败返回空串
 * 校验通过返回规范化后的 URL, 否则返回 '' (调用方据此决定是否渲染链接)。
 */
export function sanitizeUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s || s.length > MAX_URL_LEN) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

/**
 * 清洗一个 URL 数组, 逐项校验, 保留原始顺序 (无效项用 '' 占位以便与文本数组对齐)。
 * @param keepAlignment 为 true 时无效 URL 用 '' 占位 (与 evidence_list 对齐); 为 false 时过滤掉空串。
 */
export function sanitizeUrlList(raw: unknown, keepAlignment = true, maxItems = 30): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.slice(0, maxItems).map(sanitizeUrl);
  return keepAlignment ? out : out.filter(Boolean);
}
