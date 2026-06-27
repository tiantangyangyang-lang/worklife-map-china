import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured, getAdminPassword } from '@/lib/supabase-server';
import { sanitizeUrl, sanitizeUrlList } from '@/lib/url';
import { buildCitySummary, buildGeoJSON } from '@/lib/aggregate';
import {
  classifyWorkSystem,
  classifyWeekendType,
  classifyRiskLevel,
  classifyConfidence,
  buildClassificationBasis,
} from '@/lib/classify';
import type {
  CompanyRecord,
  SectionTitle,
  GeoLevel,
  CoordSystem,
  GeoSource,
  Confidence,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================
// 安全上限 (防止超大 / 恶意 payload)
// ============================================================
const MAX_RECORDS = 100_000;        // 单次最多导入记录数
const MAX_STR = 2_000;              // 普通字符串字段最大长度
const MAX_LONG_STR = 8_000;         // 证据等长文本字段最大长度
const MAX_LIST = 30;                // 数组字段最大元素数

const VALID_SECTIONS: SectionTitle[] = ['955', '965', '996'];
const VALID_GEO_LEVELS: GeoLevel[] = ['coordinate', 'address', 'district', 'city', 'unknown'];
const VALID_COORD_SYSTEMS: CoordSystem[] = ['wgs84', 'gcj02', 'bd09', 'unknown'];
const VALID_GEO_SOURCES: GeoSource[] = ['manual', 'excel', 'api', 'geocoded'];
const VALID_CONFIDENCES: Confidence[] = ['A', 'B', 'C', 'D', 'E'];

interface ImportRequestBody {
  password?: string;
  fileName?: string;
  records?: unknown[];
}

/**
 * POST /api/admin/import
 *
 * 管理员上传 Excel 解析后的 records。服务端做三件事:
 *   1. 鉴权 (常数时间比较管理员密码) + Supabase 配置检查
 *   2. 服务端"零信任"清洗: 字段白名单 + 类型/长度/范围校验, 并**重新分类**
 *      (work_system / weekend_type / risk_level / confidence / 分类依据),
 *      不信任客户端算好的分类结果, 防止注入伪造数据
 *   3. 原子发布: 优先调用 RPC publish_dataset (单事务); 缺函数时回退到
 *      "先插入(inactive) 再提升" 的安全两步法, 避免出现零激活窗口
 */
export async function POST(req: Request) {
  // ===== 1. 配置检查 =====
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'supabase_not_configured', message: '服务端未配置 Supabase, 无法保存公共数据' },
      { status: 503 },
    );
  }

  const adminPwd = getAdminPassword();
  if (!adminPwd) {
    return NextResponse.json(
      { error: 'admin_not_configured', message: '服务端未配置 ADMIN_UPLOAD_PASSWORD, 无法上传' },
      { status: 403 },
    );
  }

  // ===== 2. 解析请求体 =====
  let body: ImportRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: '请求体不是合法 JSON' },
      { status: 400 },
    );
  }

  // ===== 3. 鉴权 =====
  if (!body.password || typeof body.password !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: '缺少 password 字段' },
      { status: 400 },
    );
  }
  if (!constantTimeEqual(body.password, adminPwd)) {
    return NextResponse.json(
      { error: 'unauthorized', message: '管理员密码错误' },
      { status: 401 },
    );
  }

  // ===== 4. 记录数校验 =====
  if (!Array.isArray(body.records) || body.records.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'records 必须是非空数组' },
      { status: 400 },
    );
  }
  if (body.records.length > MAX_RECORDS) {
    return NextResponse.json(
      { error: 'payload_too_large', message: `records 数量超过上限 ${MAX_RECORDS}` },
      { status: 413 },
    );
  }

  // ===== 5. 服务端清洗 + 重新分类 (零信任) =====
  const records: CompanyRecord[] = [];
  for (let i = 0; i < body.records.length; i++) {
    const clean = sanitizeAndReclassify(body.records[i], i);
    if (clean) records.push(clean);
  }
  if (records.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', message: '所有记录清洗后均无效 (缺少公司名或城市)' },
      { status: 400 },
    );
  }

  const fileName =
    typeof body.fileName === 'string' && body.fileName.trim()
      ? body.fileName.trim().slice(0, MAX_STR)
      : 'unknown.xlsx';

  // ===== 6. 服务端生成聚合 + GeoJSON =====
  const citySummary = buildCitySummary(records);
  const geojson = buildGeoJSON(citySummary);

  // ===== 7. 写入 Supabase =====
  const supabase = getSupabaseServer()!;

  try {
    // 7.1 计算新版本号 (当前最大 version + 1)
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

    // 7.2 优先走原子 RPC
    const rpc = await supabase.rpc('publish_dataset', {
      p_version: newVersion,
      p_file_name: fileName,
      p_record_count: records.length,
      p_city_count: citySummary.length,
      p_records: records,
      p_city_summary: citySummary,
      p_geojson: geojson,
    });

    if (!rpc.error) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      console.log(`[/api/admin/import] (rpc) 导入成功: version=${row?.version}, records=${records.length}, cities=${citySummary.length}`);
      return NextResponse.json({
        success: true,
        version: row?.version ?? newVersion,
        recordCount: records.length,
        cityCount: citySummary.length,
        fileName,
        createdAt: row?.created_at,
      });
    }

    // RPC 不存在 (库里还没建函数) → 回退到安全两步法; 其它 RPC 错误才直接报错
    const rpcMissing =
      rpc.error.code === 'PGRST202' ||
      /publish_dataset|function .* does not exist|could not find the function/i.test(rpc.error.message || '');
    if (!rpcMissing) {
      console.error('[/api/admin/import] rpc publish_dataset error:', rpc.error);
      return NextResponse.json(
        { error: 'database_error', message: rpc.error.message },
        { status: 500 },
      );
    }

    // 7.3 回退: 先插入 inactive (数据先落库), 再停用旧版本, 最后提升新版本。
    //     如果中途失败, 数据已安全持久化 (inactive), 不会出现"既丢数据又零激活"。
    const { data: inserted, error: insertErr } = await supabase
      .from('datasets')
      .insert({
        version: newVersion,
        file_name: fileName,
        record_count: records.length,
        city_count: citySummary.length,
        records,
        city_summary: citySummary,
        geojson,
        is_active: false,
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

    // 记下当前激活版本, 失败时可回滚
    const { data: prevActive } = await supabase
      .from('datasets')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    const { error: deactivateErr } = await supabase
      .from('datasets')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateErr) {
      console.error('[/api/admin/import] deactivate error:', deactivateErr);
      return NextResponse.json(
        { error: 'database_error', message: `数据已保存(v${newVersion})但停用旧版本失败: ${deactivateErr.message}` },
        { status: 500 },
      );
    }

    const { error: activateErr } = await supabase
      .from('datasets')
      .update({ is_active: true })
      .eq('id', inserted.id);

    if (activateErr) {
      // 提升失败: 尝试把上一个激活版本恢复, 避免零激活
      console.error('[/api/admin/import] activate error, attempting rollback:', activateErr);
      if (prevActive?.id) {
        await supabase.from('datasets').update({ is_active: true }).eq('id', prevActive.id);
      }
      return NextResponse.json(
        { error: 'database_error', message: `数据已保存(v${newVersion})但激活失败, 已尝试恢复上一版本: ${activateErr.message}` },
        { status: 500 },
      );
    }

    console.log(`[/api/admin/import] (fallback) 导入成功: version=${inserted.version}, records=${records.length}, cities=${citySummary.length}`);
    return NextResponse.json({
      success: true,
      version: inserted.version,
      recordCount: records.length,
      cityCount: citySummary.length,
      fileName,
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

// ============================================================
// 工具
// ============================================================

/** 常数时间字符串比较, 避免 timing attack */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function str(v: unknown, max = MAX_STR): string {
  if (v === null || v === undefined) return '';
  return String(v).slice(0, max);
}

function strList(v: unknown, maxItems = MAX_LIST, maxLen = MAX_STR): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map(x => str(x, maxLen)).filter(Boolean);
}

function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** 解析经纬度, 仅接受落在中国大致范围内的数值, 否则 null */
function parseChinaCoord(lng: unknown, lat: unknown): { lng: number | null; lat: number | null } {
  const x = typeof lng === 'number' ? lng : parseFloat(String(lng));
  const y = typeof lat === 'number' ? lat : parseFloat(String(lat));
  if (!isFinite(x) || !isFinite(y)) return { lng: null, lat: null };
  if (x < 73 || x > 135 || y < 18 || y > 54) return { lng: null, lat: null };
  return { lng: x, lat: y };
}

/**
 * 把一条来自客户端的原始记录清洗成可信的 CompanyRecord:
 *   - 字段白名单 + 类型/长度/范围裁剪
 *   - **重新分类** 所有派生字段 (不信任客户端的 work_system / risk_level 等)
 * 缺少公司名和城市的记录视为无效, 返回 null 丢弃。
 */
function sanitizeAndReclassify(raw: unknown, index: number): CompanyRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const company_name = str(r.company_name, 200);
  const city = str(r.city, 100);
  if (!company_name && !city) return null; // 无主键信息, 丢弃

  const section = oneOf<SectionTitle>(r.section, VALID_SECTIONS, '965');
  const rule_text = str(r.rule_text, MAX_STR);
  const evidence_text = str(r.evidence_text, MAX_LONG_STR);
  const evidence_list = strList(r.evidence_list, MAX_LIST, MAX_STR);
  const time_raw = str(r.time_raw, 100);
  const event_date = str(r.event_date, 32);

  // 用记录自身的文本重新分类 (零信任客户端的分类结果)
  const fullText = `${city} ${company_name} ${time_raw} ${rule_text} ${evidence_text}`;
  const ruleAndEvidence = `${rule_text} ${evidence_text}`;
  const work_system = classifyWorkSystem(fullText, section);
  const weekend_type = classifyWeekendType(fullText, section, work_system);
  const risk_level = classifyRiskLevel(work_system, ruleAndEvidence);
  const confidence = classifyConfidence(section, rule_text, evidence_list);
  const classification_basis = buildClassificationBasis(
    fullText, section, work_system, weekend_type, risk_level, ruleAndEvidence,
  );

  const { lng, lat } = parseChinaCoord(r.lng, r.lat);
  const geo_level = oneOf<GeoLevel>(
    r.geo_level,
    VALID_GEO_LEVELS,
    lng !== null ? 'coordinate' : (city ? 'city' : 'unknown'),
  );

  return {
    id: str(r.id, 64) || `rec_${index}`,
    company_name,
    company_name_raw: str(r.company_name_raw, 200) || company_name,
    city,
    city_raw: str(r.city_raw, 100) || city,
    city_list: strList(r.city_list, MAX_LIST, 100),
    province: str(r.province, 50),
    district: str(r.district, 100),
    address: str(r.address, 300),
    geo_level,
    lng,
    lat,
    coord_system: oneOf<CoordSystem>(r.coord_system, VALID_COORD_SYSTEMS, 'unknown'),
    geo_source: oneOf<GeoSource>(r.geo_source, VALID_GEO_SOURCES, 'excel'),
    geo_confidence: oneOf<Confidence>(r.geo_confidence, VALID_CONFIDENCES, 'D'),
    section,
    work_system,
    weekend_type,
    risk_level,
    classification_basis,
    time_raw,
    event_date,
    rule_text,
    evidence_text,
    evidence_list,
    // 链接保留 (零信任: 服务端重新校验, 只放行 http/https)
    company_url: sanitizeUrl(r.company_url) || undefined,
    evidence_links: (() => {
      const links = sanitizeUrlList(r.evidence_links, true, MAX_LIST);
      return links.some(Boolean) ? links : undefined;
    })(),
    // V4: 招聘站 / 多来源扩展字段 (零信任: source_url 服务端重新校验只放行 http/https)
    department: str(r.department, 100) || undefined,
    job_title: str(r.job_title, 150) || undefined,
    work_begin: str(r.work_begin, 20) || undefined,
    work_end: str(r.work_end, 20) || undefined,
    workdays: str(r.workdays, 20) || undefined,
    source_platform: str(r.source_platform, 50) || undefined,
    source_url: sanitizeUrl(r.source_url) || undefined,
    collected_at: str(r.collected_at, 32) || undefined,
    source_type: str(r.source_type, 50),
    source_name: str(r.source_name, MAX_STR),
    source_sheet: str(r.source_sheet, 100),
    source_row: Number.isFinite(r.source_row as number) ? Number(r.source_row) : index,
    confidence,
    updated_at: new Date().toISOString(),
  };
}
