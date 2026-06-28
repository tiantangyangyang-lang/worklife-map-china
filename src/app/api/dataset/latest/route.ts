import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dataset/latest
 *
 * 返回当前激活的公共数据集。P1 #4: 支持两种模式, 默认只返回轻量摘要,
 * 明细 records 改由 /api/dataset/records 按需 (后台/分页) 拉取, 避免首屏
 * 一次性下载全量 records (数据量大时会触顶 Serverless 4.5MB 响应上限)。
 *
 *   ?mode=summary (默认): { id, version, file_name, record_count, city_count,
 *                           city_summary, geojson, created_at }  —— 不含 records
 *   ?mode=full          : 在 summary 基础上额外带 records (导出 / 兼容老逻辑用)
 *
 * 无 Supabase 配置 → 503; 无激活数据集 → 404, 客户端 fallback 到 public/data。
 */
export async function GET(req: Request) {
  const supabase = getSupabaseServer();

  if (!supabase || !isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'supabase_not_configured', message: 'Supabase 未配置, 请使用预置示例数据' },
      { status: 503 },
    );
  }

  const mode = new URL(req.url).searchParams.get('mode') === 'full' ? 'full' : 'summary';
  const columns =
    mode === 'full'
      ? 'id, version, file_name, record_count, city_count, records, city_summary, geojson, created_at'
      : 'id, version, file_name, record_count, city_count, city_summary, geojson, created_at';

  try {
    const { data, error } = await supabase
      .from('datasets')
      .select(columns)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[/api/dataset/latest] supabase error:', error);
      return NextResponse.json(
        { error: 'database_error', message: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'no_active_dataset', message: '数据库中暂无公共数据, 请使用预置示例数据' },
        { status: 404 },
      );
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (e) {
    console.error('[/api/dataset/latest] unexpected error:', e);
    return NextResponse.json(
      { error: 'internal_error', message: e instanceof Error ? e.message : '未知错误' },
      { status: 500 },
    );
  }
}
