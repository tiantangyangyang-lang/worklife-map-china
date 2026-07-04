import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase-server';
import type { CompanyRecord } from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GET /api/companies
 *
 * Server‑side filtering & pagination for public company records.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function filterRecords(records: CompanyRecord[], params: URLSearchParams): CompanyRecord[] {
  const city = params.get('city')?.trim() ?? '';
  const district = params.get('district')?.trim() ?? '';
  const workSystem = params.get('work_system')?.trim() ?? '';
  const weekendType = params.get('weekend_type')?.trim() ?? '';
  const intensityLevel = params.get('intensity_level')?.trim() ?? '';
  const q = params.get('q')?.trim().toLowerCase() ?? '';

  let result = records;
  if (city) result = result.filter(r => r.city === city);
  if (district) result = result.filter(r => r.district === district);
  if (workSystem) result = result.filter(r => r.work_system === workSystem);
  if (weekendType) result = result.filter(r => r.weekend_type === weekendType);
  if (intensityLevel) result = result.filter(r => r.risk_level === intensityLevel);
  if (q) {
    result = result.filter(r =>
      r.company_name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      (r.district?.toLowerCase().includes(q) ?? false) ||
      (r.rule_text?.toLowerCase().includes(q) ?? false) ||
      (r.evidence_text?.toLowerCase().includes(q) ?? false)
    );
  }
  return result;
}

export async function GET(req: Request) {
  const supabase = getSupabaseServer();
  const params = new URL(req.url).searchParams;

  const paginate = (arr: CompanyRecord[]) => {
    const limitRaw = parseInt(params.get('limit') ?? '0', 10);
    const pageRaw = parseInt(params.get('page') ?? '1', 10);
    const limit = limitRaw > 0 ? limitRaw : 50;
    const page = pageRaw > 0 ? pageRaw : 1;
    const offset = (page - 1) * limit;
    const total = arr.length;
    const records = arr.slice(offset, offset + limit);
    return { total, page, limit, records };
  };

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('datasets')
        .select('records')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const raw = (Array.isArray(data?.records) ? data.records : []) as CompanyRecord[];
      const filtered = filterRecords(raw, params);
      return NextResponse.json(paginate(filtered), { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    } catch (e) {
      console.error('[/api/companies] supabase error:', e);
      return NextResponse.json({ error: 'internal_error', message: e instanceof Error ? e.message : '未知错误' }, { status: 500 });
    }
  }

  // fallback static data
  try {
    const filePath = path.resolve(process.cwd(), 'public', 'data', 'normalized_companies.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = JSON.parse(content) as CompanyRecord[];
    const filtered = filterRecords(raw, params);
    return NextResponse.json(paginate(filtered), { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    console.error('[/api/companies] fallback load error:', e);
    return NextResponse.json({ error: 'data_unavailable', message: '无法加载公司数据' }, { status: 500 });
  }
}

