// ============================================================
// 招聘站数据入库脚本 (PRD-0002): 公开职位页正文 → 结构化作息明细表
//
// 合规声明:
//   - 本脚本不抓取、不登录、不绕验证码、不采集简历/手机号/HR 联系方式等隐私。
//   - 抓取由用户在合规前提下自行完成, 脚本只负责"用户提供的公开正文 → 结构化字段"。
//
// 用法:
//   # JSON 输入 (推荐): 一个数组, 每条 { source_url, source_platform?, text }
//   DEEPSEEK_API_KEY=sk-... bun run scripts/ingest-recruit.ts input.json
//
//   # 单个文本/HTML 文件 (需用 --url 指定职位页链接作为证据)
//   DEEPSEEK_API_KEY=sk-... bun run scripts/ingest-recruit.ts job.txt --url https://www.zhipin.com/job_detail/x.html --platform BOSS直聘
//
// 选项:
//   --out <file>       输出文件路径 (默认 data/recruit-ingest-<时间戳>.xlsx)
//   --limit <N>        最多处理 N 条 (控制 DeepSeek 调用量与成本)
//   --url <URL>        单文件输入时的职位页 URL (作为 source_url 证据, 必填)
//   --platform <NAME>  来源平台 (如 BOSS直聘 / 51job / 智联招聘)
//   --json             额外写出同名 .json 明细 (便于核对)
//   --model <NAME>     覆盖 DeepSeek 模型 (默认 deepseek-chat)
//
// 产出: 列名对齐 recruit_detail 明细表 (见 docs/EXCEL_IMPORT.md), 可直接走"上传数据"入库。
// ============================================================
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { deepseekJson, DeepSeekError } from '../src/lib/deepseek';
import { splitCities } from '../src/lib/normalize';
import { sanitizeUrl } from '../src/lib/url';

// ------------------------------------------------------------
// 输出列名: 必须与 parseDetailTable 的表头别名一致 (src/lib/normalize.ts)
// ------------------------------------------------------------
const DETAIL_HEADERS = [
  '公司', '城市', '部门', '岗位', '工作制度', '周末类型',
  '上班时间', '下班时间', '一周工作天数', '规则', '证据',
  '来源平台', '来源链接', '可信度', '采集时间',
] as const;

/** DeepSeek 输出的单条记录 schema (PRD-0002 §3) */
interface RecruitSignal {
  company_name: string;
  city: string;
  department: string;
  job_title: string;
  work_system: string;
  weekend_type: string;
  work_begin: string;
  work_end: string;
  workdays: string;
  evidence_text: string;
  confidence: string;
}

/** 输入项 (JSON 输入数组的元素 / 单文件输入构造出的一项) */
interface InputItem {
  source_url: string;
  source_platform?: string;
  text: string;
}

// ------------------------------------------------------------
// DeepSeek 提示词: schema + 抽取规则 + few-shot
// (json_object 模式要求提示中出现 "json" 字样, 下面 schema 已满足)
// ------------------------------------------------------------
const SYSTEM_PROMPT = `你是招聘职位页"作息信号"抽取器。只依据用户给出的职位页公开正文, 抽取结构化作息字段, 严格输出一个 JSON 对象 (不要 markdown 代码块, 不要任何解释文字)。

输出 JSON 对象 schema:
{
  "company_name": string,   // 招聘公司全称; 正文找不到则留 ""
  "city": string,           // 工作城市, 单个城市名 (如 "杭州"); 多个工作地取主要那个
  "department": string,     // 部门 (如 "研发中心"); 无则 ""
  "job_title": string,      // 岗位/职位名 (如 "后端工程师"); 无则 ""
  "work_system": string,    // 工作制度, 取值之一: 955 / 965 / 996 / 997 / 007 / 大小周 / 单休 / 双休 / 排班 / 加班; 推断不出留 ""
  "weekend_type": string,   // 周末类型: 双休 / 单休 / 大小周 / 排班 / 轮休; 推断不出留 ""
  "work_begin": string,     // 上班时间 "HH:MM"; 无则 ""
  "work_end": string,       // 下班时间 "HH:MM"; 无则 ""
  "workdays": string,       // 一周工作天数 "5" / "5.5" / "6"; 无则 ""
  "evidence_text": string,  // 支撑判断的正文原话片段 (≤100 字), 必填
  "confidence": "B" | "C"   // 招聘页"明确写出"作息 → "B"; 需要推断 → "C"
}

抽取规则:
- 只用正文事实, 严禁编造。正文没有的字段一律留空字符串 ""。
- "朝九晚六 / 9:00-18:00 / 双休 / 不加班" → work_system 倾向 955 或 965, weekend_type=双休, work_begin/work_end 按原文填。
- "大小周 / 单双周" → work_system=大小周, weekend_type=大小周。
- "单休 / 做六休一 / 月休4天" → weekend_type=单休, workdays=6。
- "996 / 朝九晚九一周六天" → work_system=996, weekend_type=单休, work_begin=09:00, work_end=21:00, workdays=6。
- "弹性工作 / 扁平管理" 等模糊词不算明确作息, confidence 用 "C"。
- evidence_text 摘抄正文中最能支撑判断的一两句原话。`;

function buildUserPrompt(item: InputItem): string {
  const platform = item.source_platform ? `来源平台: ${item.source_platform}\n` : '';
  return `${platform}请从下面这段招聘职位页正文中抽取作息信号, 按 schema 输出 JSON:\n\n"""\n${item.text.slice(0, 12000)}\n"""`;
}

// ------------------------------------------------------------
// 参数解析
// ------------------------------------------------------------
interface CliArgs {
  input?: string;
  out?: string;
  limit?: number;
  url?: string;
  platform?: string;
  json: boolean;
  model?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--out': args.out = argv[++i]; break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
      case '--url': args.url = argv[++i]; break;
      case '--platform': args.platform = argv[++i]; break;
      case '--model': args.model = argv[++i]; break;
      case '--json': args.json = true; break;
      default:
        if (!a.startsWith('--') && !args.input) args.input = a;
        break;
    }
  }
  return args;
}

// ------------------------------------------------------------
// 输入读取: .json → 数组; 其他 (.txt/.html/...) → 单文件
// ------------------------------------------------------------
/** 极简 HTML 去标签 (仅用于把用户提供的 HTML 正文转纯文本, 不做抓取) */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadInputs(args: CliArgs): InputItem[] {
  if (!args.input) {
    throw new Error('缺少输入文件。用法: bun run scripts/ingest-recruit.ts <input.json|job.txt> [选项]');
  }
  if (!fs.existsSync(args.input)) {
    throw new Error(`输入文件不存在: ${args.input}`);
  }
  // 去掉可能的 UTF-8 BOM (Windows 记事本 / PowerShell 常带), 否则 JSON.parse 会失败
  const raw = fs.readFileSync(args.input, 'utf-8').replace(/^﻿/, '');
  const ext = path.extname(args.input).toLowerCase();

  if (ext === '.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`JSON 输入解析失败: ${args.input}`);
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((it, idx) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const url = String(o.source_url ?? o.url ?? args.url ?? '').trim();
      const text = String(o.text ?? o.content ?? o.body ?? '').trim();
      const platform = (o.source_platform ?? o.platform ?? args.platform) as string | undefined;
      if (!text) throw new Error(`第 ${idx + 1} 条缺少正文 (text/content/body)`);
      return { source_url: url, source_platform: platform, text };
    });
  }

  // 单文件文本 / HTML 输入
  const text = ext === '.html' || ext === '.htm' ? stripHtml(raw) : raw.trim();
  if (!text) throw new Error(`输入文件为空: ${args.input}`);
  return [{ source_url: String(args.url ?? '').trim(), source_platform: args.platform, text }];
}

// ------------------------------------------------------------
// 本地校验: 字段白名单 + URL sanitize + 城市归一 + confidence 规范化
// ------------------------------------------------------------
const ALLOWED_CONFIDENCE = new Set(['A', 'B', 'C', 'D', 'E']);

interface ValidatedRow {
  company_name: string;
  city: string;
  department: string;
  job_title: string;
  work_system: string;
  weekend_type: string;
  work_begin: string;
  work_end: string;
  workdays: string;
  rule: string;
  evidence_text: string;
  source_platform: string;
  source_url: string;
  confidence: string;
  collected_at: string;
}

/** 把 DeepSeek 抽取结果 + 输入项合并为通过校验的一行; 不合格返回 null */
function validate(signal: RecruitSignal, item: InputItem, today: string): ValidatedRow | null {
  const s = (v: unknown): string => String(v ?? '').trim();

  const company = s(signal.company_name);
  if (!company) return null; // 公司名必填

  // source_url 必填 (作为证据), 以输入项为准 (不信任模型生成的 URL)
  const sourceUrl = sanitizeUrl(item.source_url);
  if (!sourceUrl) return null;

  // 城市归一: 取主要城市 (复用 splitCities 的过滤/拆分逻辑)
  const cities = splitCities(s(signal.city));
  const city = cities[0] || s(signal.city);

  // confidence 规范化: 仅接受 A-E, 缺省/非法 → C (需人工复核)
  const confRaw = s(signal.confidence).toUpperCase();
  const confidence = ALLOWED_CONFIDENCE.has(confRaw) ? confRaw : 'C';

  return {
    company_name: company,
    city,
    department: s(signal.department),
    job_title: s(signal.job_title),
    work_system: s(signal.work_system),
    weekend_type: s(signal.weekend_type),
    work_begin: s(signal.work_begin),
    work_end: s(signal.work_end),
    workdays: s(signal.workdays),
    rule: s(signal.work_system) || s(signal.weekend_type), // 规则列冗余写制度, 便于关键词分类兜底
    evidence_text: s(signal.evidence_text),
    source_platform: s(item.source_platform) || s((signal as Record<string, unknown>).source_platform),
    source_url: sourceUrl,
    confidence,
    collected_at: today,
  };
}

function rowToAoa(r: ValidatedRow): (string)[] {
  return [
    r.company_name, r.city, r.department, r.job_title, r.work_system, r.weekend_type,
    r.work_begin, r.work_end, r.workdays, r.rule, r.evidence_text,
    r.source_platform, r.source_url, r.confidence, r.collected_at,
  ];
}

// ------------------------------------------------------------
// 主流程
// ------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));

  let inputs: InputItem[];
  try {
    inputs = loadInputs(args);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  if (args.limit && args.limit > 0) {
    inputs = inputs.slice(0, args.limit);
  }
  console.log(`📥 待处理职位页: ${inputs.length} 条`);

  const today = new Date().toISOString().slice(0, 10);
  const rows: ValidatedRow[] = [];
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < inputs.length; i++) {
    const item = inputs[i];
    const tag = `[${i + 1}/${inputs.length}]`;
    try {
      const signal = await deepseekJson<RecruitSignal>(
        SYSTEM_PROMPT,
        buildUserPrompt(item),
        { model: args.model, temperature: 0 },
      );
      const row = validate(signal, item, today);
      if (!row) {
        skipped++;
        console.warn(`⏭️  ${tag} 跳过 (缺公司名或 source_url 无效): ${item.source_url || '(无 URL)'}`);
        continue;
      }
      rows.push(row);
      console.log(`✅ ${tag} ${row.company_name} / ${row.city} / ${row.work_system || '?'} (${row.confidence})`);
    } catch (err) {
      failed++;
      if (err instanceof DeepSeekError && /DEEPSEEK_API_KEY/.test(err.message)) {
        console.error(`❌ ${err.message}`);
        process.exit(1); // 无 key: 立即清晰报错退出, 不继续
      }
      console.error(`⚠️  ${tag} 抽取失败: ${(err as Error).message}`);
    }
  }

  if (rows.length === 0) {
    console.error(`\n❌ 无可写出的记录 (成功 0, 失败 ${failed}, 跳过 ${skipped})。`);
    process.exit(1);
  }

  // 输出路径
  const outPath = args.out
    || path.join(process.cwd(), 'data', `recruit-ingest-${today}-${Date.now()}.xlsx`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // 写 Excel (明细表格式, 解析器自动识别)
  const aoa: (string)[][] = [DETAIL_HEADERS.slice(), ...rows.map(rowToAoa)];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'recruit_detail');
  XLSX.writeFile(wb, outPath);

  console.log(`\n💾 已写出: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  console.log(`   记录: 成功 ${rows.length}, 失败 ${failed}, 跳过 ${skipped}`);

  if (args.json) {
    const jsonPath = outPath.replace(/\.xlsx$/i, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`   附带 JSON: ${jsonPath}`);
  }

  console.log('\n➡️  下一步: 在站点"上传数据"导入该 .xlsx, 详情页可见岗位/作息时间 + 可点击"查看来源页"。');
}

main();
