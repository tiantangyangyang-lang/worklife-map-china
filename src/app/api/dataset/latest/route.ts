import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dataset/latest
 *
 * 返回当前激活的公共数据集 (records + city_summary + geojson + meta)
 * 客户端首次加载时调用此接口, 拿到数据后渲染地图。
 *
 * 如果数据库未配置或没有激活数据集, 返回 404, 客户端 fallback 到 public/data。
 *
 * 响应体:
 *   {
 *     id, version, file_name, record_count, city_count,
 *     records: CompanyRecord[],
 *     city_summary: CitySummary[],
 *     geojson: GeoJSONCollection,
 *     created_at
 *   }
 */
export async function GET() {
  const supabase = getSupabaseServer();

  if (!supabase || !isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'supabase_not_configured', message: 'Supabase 未配置, 请使用预置示例数据' },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await supabase
      .from('datasets')
      .select('id, version, file_name, record_count, city_count, records, city_summary, geojson, created_at')
      .eq('is_active', true)
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
      // 数据库里没有激活数据集, 让客户端 fallback
      return NextResponse.json(
        { error: 'no_active_dataset', message: '数据库中暂无公共数据, 请使用预置示例数据' },
        { status: 404 },
      );
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e) {
    console.error('[/api/dataset/latest] unexpected error:', e);
    return NextResponse.json(
      { error: 'internal_error', message: e instanceof Error ? e.message : '未知错误' },
      { status: 500 },
    );
  }
}
