// ============================================================
// Supabase 服务端客户端 (用于 API routes)
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 服务端 Supabase 客户端 (使用 service_role key, 绕过 RLS)
 *
 * 环境变量:
 *   SUPABASE_URL          - 项目 URL
 *   SUPABASE_SERVICE_KEY  - service_role key (仅服务端, 不暴露给浏览器)
 *   ADMIN_UPLOAD_PASSWORD - 管理员上传密码
 *
 * 如果环境变量未配置, 返回 null, API 会返回 503 提示未配置。
 */
let _client: SupabaseClient | null | undefined = null;

export function getSupabaseServer(): SupabaseClient | null {
  if (_client !== undefined) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    _client = null;
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** 读取管理员上传密码 (env var ADMIN_UPLOAD_PASSWORD) */
export function getAdminPassword(): string | null {
  const pwd = process.env.ADMIN_UPLOAD_PASSWORD;
  if (!pwd || !pwd.trim()) return null;
  return pwd.trim();
}

/** 判断 Supabase 是否已配置 (用于 API 返回友好错误) */
export function isSupabaseConfigured(): boolean {
  return getSupabaseServer() !== null;
}
