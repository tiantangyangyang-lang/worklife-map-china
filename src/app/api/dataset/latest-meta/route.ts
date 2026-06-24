import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dataset/latest-meta
 *
 * 只返回当前激活数据集的轻量元信息 (不包含 records / city_summary / geojson)
 * 客户端每 10 秒轮询此接口, 比较 version 是否变化, 决定是否需要重新拉取完整数据。
 *
 * 响应体: { id, version, file_name, record_count, city_count, created_at }
 */
export async function GET() {
  const supabase = getSupabaseServer();

  if (!supabase || !isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'supabase_not_configured' },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, version, file_name, record_count, city_count, created_at')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[/api/dataset/latest-meta] supabase error:', error);
      return NextResponse.json(
        { error: 'database_error', message: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'no_active_dataset' },
        { status: 404 },
      );
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e) {
    console.error('[/api/dataset/latest-meta] unexpected error:', e);
    return NextResponse.json(
      { error: 'internal_error', message: e instanceof Error ? e.message : '未知错误' },
      { status: 500 },
    );
  }
}
