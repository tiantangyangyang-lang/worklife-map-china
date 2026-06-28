import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase-server';
import type { CompanyRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dataset/records
 *
 * P1 #4: 按需返回当前激活数据集的明细记录 (与 /api/dataset/latest?mode=summary 配套)。
 * 客户端先用 summary 渲染城市图+统计, 再后台拉这里的 records 解锁筛选/搜索/公司点位图。
 *
 * 查询参数:
 *   ?city=<城市>   只返回该城市的记录 (点击城市看公司列表时用)
 *   ?offset=<n>    分页偏移 (默认 0)
 *   ?limit=<n>     分页大小 (默认全部; 设置后可把单次响应控制在 4.5MB 上限内)
 *
 * 响应: { version, total, offset, limit, records }
 *
 * 注: 当前 records 存为单个 JSONB blob, 这里在服务端读出后切片/过滤。数据规模
 * 很大时, 后续应把 records normalize 成独立行表, 用 SQL 直接分页 (见 OPTIMIZATION P1)。
 */
export async function GET(req: Request) {
  const supabase = getSupabaseServer();

  if (!supabase || !isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'supabase_not_configured', message: 'Supabase 未配置' },
      { status: 503 },
    );
  }

  const params = new URL(req.url).searchParams;
  const city = params.get('city')?.trim() || '';
  const offset = Math.max(0, parseInt(params.get('offset') || '0', 10) || 0);
  const limitRaw = parseInt(params.get('limit') || '0', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 0; // 0 = 不分页

  try {
    const { data, error } = await supabase
      .from('datasets')
      .select('version, records')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[/api/dataset/records] supabase error:', error);
      return NextResponse.json(
        { error: 'database_error', message: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: 'no_active_dataset', message: '数据库中暂无公共数据' },
        { status: 404 },
      );
    }

    let records = (Array.isArray(data.records) ? data.records : []) as CompanyRecord[];
    if (city) records = records.filter(r => r.city === city);

    const total = records.length;
    const page = limit > 0 ? records.slice(offset, offset + limit) : records.slice(offset);

    return NextResponse.json(
      { version: data.version, total, offset, limit, records: page },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (e) {
    console.error('[/api/dataset/records] unexpected error:', e);
    return NextResponse.json(
      { error: 'internal_error', message: e instanceof Error ? e.message : '未知错误' },
      { status: 500 },
    );
  }
}
