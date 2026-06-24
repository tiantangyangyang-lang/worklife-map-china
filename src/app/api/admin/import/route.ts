import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured, getAdminPassword } from '@/lib/supabase-server';
import { buildCitySummary, buildGeoJSON } from '@/lib/aggregate';
import type { CompanyRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ImportRequestBody {
  password?: string;
  fileName?: string;
  records?: CompanyRecord[];
}

/**
 * POST /api/admin/import
 *
 * 管理员上传 Excel 解析后的 records, 服务端:
 *   1. 校验管理员密码 (env var ADMIN_UPLOAD_PASSWORD)
 *   2. 校验 records 非空
 *   3. 生成 city_summary + geojson
 *   4. 计算新版本号 (当前最大 version + 1)
 *   5. 把旧记录的 is_active 置为 false, 插入新记录 is_active = true
 *
 * 请求体:
 *   {
 *     password: string,        // 管理员密码
 *     fileName: string,        // 上传文件名
 *     records: CompanyRecord[] // 解析后的标准化记录
 *   }
 *
 * 响应:
 *   200: { success: true, version, recordCount, cityCount, fileName }
 *   400: { error: 'invalid_request' }  - 请求体格式错误
 *   401: { error: 'unauthorized' }     - 密码错误
 *   403: { error: 'admin_not_configured' } - 服务端未配置管理员密码
 *   503: { error: 'supabase_not_configured' } - Supabase 未配置
 */
export async function POST(req: Request) {
  // ===== 1. 检查 Supabase 是否配置 =====
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'supabase_not_configured', message: '服务端未配置 Supabase, 无法保存公共数据' },
      { status: 503 },
    );
  }

  // ===== 2. 检查管理员密码是否配置 =====
  const adminPwd = getAdminPassword();
  if (!adminPwd) {
    return NextResponse.json(
      { error: 'admin_not_configured', message: '服务端未配置 ADMIN_UPLOAD_PASSWORD, 无法上传' },
      { status: 403 },
    );
  }

  // ===== 3. 解析请求体 =====
  let body: ImportRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: '请求体不是合法 JSON' },
      { status: 400 },
    );
  }

  // ===== 4. 校验密码 =====
  if (!body.password || typeof body.password !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: '缺少 password 字段' },
      { status: 400 },
    );
  }
  // 用常数时间比较避免 timing attack
  if (!constantTimeEqual(body.password, adminPwd)) {
    return NextResponse.json(
      { error: 'unauthorized', message: '管理员密码错误' },
      { status: 401 },
    );
  }

  // ===== 5. 校验 records =====
  if (!Array.isArray(body.records) || body.records.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'records 必须是非空数组' },
      { status: 400 },
    );
  }
  const records = body.records as CompanyRecord[];
  const fileName = (body.fileName && typeof body.fileName === 'string')
    ? body.fileName
    : 'unknown.xlsx';

  // ===== 6. 生成 city_summary + geojson =====
  const citySummary = buildCitySummary(records);
  const geojson = buildGeoJSON(citySummary);

  // ===== 7. 写入 Supabase =====
  const supabase = getSupabaseServer()!;

  try {
    // 7.1 查询当前最大 version
    const { data: latestRow, error: queryErr } = await supabase
      .from('datasets')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryErr) {
      console.error('[/api/admin/import] query max version error:', queryErr);
      return NextResponse.json(
        { error: 'database_error', message: queryErr.message },
        { status: 500 },
      );
    }

    const newVersion = (latestRow?.version ?? 0) + 1;

    // 7.2 插入新记录 (is_active = true)
    //     依赖 partial unique index datasets_is_active_unique: 同一时间只能一条 is_active = true
    //     先把所有 is_active = true 置为 false, 再插入
    const { error: updateErr } = await supabase
      .from('datasets')
      .update({ is_active: false })
      .eq('is_active', true);

    if (updateErr) {
      console.error('[/api/admin/import] deactivate old error:', updateErr);
      return NextResponse.json(
        { error: 'database_error', message: `无法停用旧版本: ${updateErr.message}` },
        { status: 500 },
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('datasets')
      .insert({
        version: newVersion,
        file_name: fileName,
        record_count: records.length,
        city_count: citySummary.length,
        records: records,
        city_summary: citySummary,
        geojson: geojson,
        is_active: true,
      })
      .select('id, version, file_name, record_count, city_count, created_at')
      .single();

    if (insertErr || !inserted) {
      console.error('[/api/admin/import] insert error:', insertErr);
      return NextResponse.json(
        { error: 'database_error', message: insertErr?.message || '插入失败' },
        { status: 500 },
      );
    }

    console.log(`[/api/admin/import] 导入成功: version=${inserted.version}, records=${inserted.record_count}, cities=${inserted.city_count}, file=${fileName}`);

    return NextResponse.json({
      success: true,
      version: inserted.version,
      recordCount: inserted.record_count,
      cityCount: inserted.city_count,
      fileName: inserted.file_name,
      createdAt: inserted.created_at,
    });
  } catch (e) {
    console.error('[/api/admin/import] unexpected error:', e);
    return NextResponse.json(
      { error: 'internal_error', message: e instanceof Error ? e.message : '未知错误' },
      { status: 500 },
    );
  }
}

/** 常数时间字符串比较, 避免 timing attack */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
