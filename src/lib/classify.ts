// ============================================================
// 作息自动分类规则 (单一事实来源版)
// ============================================================
//
// 设计原则:
//   所有作息关键词规则集中在本文件顶部的"规则表"里 (WORK_SYSTEM_RULES /
//   WEEKEND_KEYWORD_RULES / SEVERE_RISK_KEYWORDS)。分类函数和"分类依据"
//   生成函数都消费同一份规则表, 不再各写一遍正则 —— 改规则只改表, 贡献者
//   无需理解分类逻辑。
//
// 历史坑位 (回归测试已覆盖, 见 classify.test.ts):
//   issue #1: Excel 日期 serial number (如 43556) 含子串 "965/996", 不能误判
//             → sanitize() 先把 ≥4 位数字整段剔除, 再做关键词匹配
//   issue #2: 995 (工作日 12h, 周末双休) 应为 双休 + 中强度, 而非 未知
//   issue #3: "高强度加班" 兜底分类只代表工时长, 不应默认推断为单休
// ============================================================
import type { WorkSystem, WeekendType, RiskLevel, SectionTitle, Confidence, ClassificationBasis } from './types';

// ============================================================
// 文本预处理
// ============================================================

/** 判断字符串是否为纯数字 (含 Excel serial date 形如 43556, 或纯数字编号) */
function isPureNumber(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

/** 判断字符串是否看起来像 Excel 数字日期 (1 ~ 80000 之间的整数) */
function looksLikeExcelSerialDate(s: string): boolean {
  const n = parseInt(s.trim(), 10);
  return !isNaN(n) && n >= 1 && n <= 80000;
}

/**
 * 已知的"长数字"作息代号 (≥4 位但确实是作息制度, 不能被当成 Excel 日期剔除)。
 * 例: 9106 = 早 9 晚 10 一周 6 天 (996 家族); 11116 = 11 点上班 11 点下班一周 6 天。
 */
const PROTECTED_WORK_CODES = ['9106', '11116'];

/**
 * 文本归一化: 转小写 + 把 ≥4 位的连续数字整段替换为空格。
 *
 * 关键: 作息代号多为 2~3 位 (955/965/996/995/997/007), 用 ≥4 位作为阈值,
 * 既能保留作息代号, 又能剔除 Excel 日期 / 记录编号 / 年份 / 时间戳等长数字,
 * 避免 "43556" 命中 "965" 子串这类误判 (issue #1)。
 *
 * 例外: 少数作息代号本身就是 ≥4 位 (9106 / 11116), 用回调逐段判断, 命中白名单
 * 的整段数字予以保留, 否则旧版本里这些关键词永远无法命中 (隐性 bug)。
 */
function sanitize(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/\d{4,}/g, m => (PROTECTED_WORK_CODES.includes(m) ? m : ' '));
}

// ============================================================
// 规则表 (单一事实来源)
// ============================================================

interface KeywordTest {
  re: RegExp;
  /** 命中时在"分类依据"里展示的关键词文案 */
  kw: string;
}

/**
 * 工作制度规则表。
 * 按数组顺序匹配, 取第一个有任意 test 命中的制度 (顺序即优先级)。
 * 短数字代号 (955/965/996...) 用负向断言确保不是长数字的子串。
 */
const WORK_SYSTEM_RULES: { system: WorkSystem; tests: KeywordTest[] }[] = [
  { system: '007', tests: [{ re: /(?<!\d)007(?!\d)/, kw: '007' }] },
  { system: '997', tests: [{ re: /(?<!\d)997(?!\d)/, kw: '997' }] },
  {
    system: '996',
    tests: [
      { re: /(?<!\d)996(?!\d)/, kw: '996' },
      { re: /9106/, kw: '9106' },
      { re: /早9晚9|早九晚九/, kw: '早9晚9' },
      { re: /11116/, kw: '11116' },
    ],
  },
  { system: '995', tests: [{ re: /(?<!\d)995(?!\d)/, kw: '995' }] },
  {
    system: '965',
    tests: [
      { re: /(?<!\d)965(?!\d)/, kw: '965' },
      { re: /9-6-5/, kw: '9-6-5' },
      { re: /9:00-18:00-5/, kw: '9:00-18:00-5' },
      { re: /9点.*6点.*5/, kw: '9点…6点…5' },
      { re: /9:00-5:30-5/, kw: '9:00-5:30-5' },
      { re: /915-530-5/, kw: '915-530-5' },
      { re: /9:30-17:30-5/, kw: '9:30-17:30-5' },
    ],
  },
  {
    system: '955',
    tests: [
      { re: /(?<!\d)955(?!\d)/, kw: '955' },
      { re: /9-5-5/, kw: '9-5-5' },
      { re: /9:00-17:00-5/, kw: '9:00-17:00-5' },
    ],
  },
  {
    system: '大小周',
    tests: [
      { re: /大小周/, kw: '大小周' },
      { re: /单双休/, kw: '单双休' },
    ],
  },
  {
    system: '单休',
    tests: [
      { re: /单休/, kw: '单休' },
      { re: /做六休一|上六休一/, kw: '做六休一/上六休一' },
      { re: /一周6天|一周7天/, kw: '一周6/7天' },
      { re: /周六加班/, kw: '周六加班' },
    ],
  },
  {
    system: '排班',
    tests: [
      { re: /排班/, kw: '排班' },
      { re: /轮休/, kw: '轮休' },
      { re: /倒班|两班倒/, kw: '倒班/两班倒' },
    ],
  },
  {
    system: '加班',
    tests: [
      { re: /义务加班/, kw: '义务加班' },
      { re: /无偿加班/, kw: '无偿加班' },
      { re: /加班/, kw: '加班' },
    ],
  },
];

/** 周末类型关键词规则 (仅显式关键词分支; 工作制度推断分支在函数里处理) */
const WEEKEND_KEYWORD_RULES: { type: WeekendType; tests: KeywordTest[] }[] = [
  {
    type: '双休',
    tests: [
      { re: /双休|周末双休/, kw: '双休' },
      { re: /做五休二/, kw: '做五休二' },
      { re: /五天工作制/, kw: '五天工作制' },
    ],
  },
  {
    type: '大小周',
    tests: [
      { re: /大小周/, kw: '大小周' },
      { re: /单双休/, kw: '单双休' },
    ],
  },
  {
    type: '排班/轮休',
    tests: [
      { re: /排班/, kw: '排班' },
      { re: /轮休/, kw: '轮休' },
      { re: /倒班|两班倒/, kw: '倒班/两班倒' },
    ],
  },
  {
    type: '单休',
    tests: [
      { re: /(?<!\d)996(?!\d)/, kw: '996' },
      { re: /9106/, kw: '9106' },
      { re: /一周6天/, kw: '一周6天' },
      { re: /周六加班/, kw: '周六加班' },
      { re: /(?<!\d)997(?!\d)/, kw: '997' },
      { re: /(?<!\d)007(?!\d)/, kw: '007' },
      { re: /单休|做六休一|上六休一/, kw: '单休/做六休一' },
    ],
  },
];

/** 极高强度违规关键词 (命中即 very_high) */
const SEVERE_RISK_KEYWORDS: KeywordTest[] = [
  { re: /拖欠工资/, kw: '拖欠工资' },
  { re: /无偿加班/, kw: '无偿加班' },
  { re: /无加班费/, kw: '无加班费' },
  { re: /裁员无补偿/, kw: '裁员无补偿' },
  { re: /强制996/, kw: '强制996' },
  { re: /强制加班/, kw: '强制加班' },
  { re: /严重违法/, kw: '严重违法' },
  { re: /猝死/, kw: '猝死' },
  { re: /降薪/, kw: '降薪' },
];

// ============================================================
// 规则匹配 (供分类与"分类依据"共用)
// ============================================================

/**
 * 匹配工作制度, 返回命中的制度及命中的关键词列表。
 * 传入文本应已 sanitize()。
 */
export function matchWorkSystem(sanitizedText: string): { system: WorkSystem | null; matched: string[] } {
  for (const rule of WORK_SYSTEM_RULES) {
    const matched = rule.tests.filter(x => x.re.test(sanitizedText)).map(x => x.kw);
    if (matched.length > 0) return { system: rule.system, matched };
  }
  return { system: null, matched: [] };
}

/** 匹配周末类型的显式关键词分支 */
function matchWeekendKeyword(sanitizedText: string): { type: WeekendType; matched: string[] } | null {
  for (const rule of WEEKEND_KEYWORD_RULES) {
    const matched = rule.tests.filter(x => x.re.test(sanitizedText)).map(x => x.kw);
    if (matched.length > 0) return { type: rule.type, matched };
  }
  return null;
}

/** 匹配极高强度违规关键词 */
function matchSevereKeywords(text: string): string[] {
  return SEVERE_RISK_KEYWORDS.filter(x => x.re.test(text || '')).map(x => x.kw);
}

// ============================================================
// 分类函数 (对外 API, 签名保持不变)
// ============================================================

/** 工作制度识别 */
export function classifyWorkSystem(text: string, section: SectionTitle): WorkSystem {
  const { system } = matchWorkSystem(sanitize(text));
  if (system) return system;

  // 兜底: 按 section 默认归类
  if (section === '955') return '955';
  if (section === '965') return '965';
  if (section === '996') return '高强度';
  return '未知';
}

/**
 * 周末休息类型识别
 *
 * issue #2: 995 → 双休 (工作日长工时但周末双休)
 * issue #3: "高强度加班" 兜底分类不再默认推断为单休, 保持未知
 */
export function classifyWeekendType(text: string, section: SectionTitle, workSystem: WorkSystem): WeekendType {
  if (section === '955') return '双休';

  const t = sanitize(text);

  // 显式关键词优先
  const kw = matchWeekendKeyword(t);
  if (kw) return kw.type;

  // 根据 work_system 推断 (仅对明确的制度)
  if (workSystem === '955' || workSystem === '965' || workSystem === '995') return '双休';
  if (workSystem === '996' || workSystem === '997' || workSystem === '007' || workSystem === '单休') return '单休';
  if (workSystem === '大小周') return '大小周';
  if (workSystem === '排班') return '排班/轮休';

  // 兜底: 不因 "高强度加班" 默认单休, 保持未知
  return '未知';
}

/**
 * 工作强度等级识别
 *
 * issue #2: 995 默认中强度, 命中加班/严重等关键词升级为高强度
 */
export function classifyRiskLevel(workSystem: WorkSystem, text: string): RiskLevel {
  const t = text || '';

  if (matchSevereKeywords(t).length > 0) return 'very_high';

  if (['996', '997', '007', '高强度'].includes(workSystem)) return 'very_high';
  if (['大小周', '单休'].includes(workSystem)) return 'high';

  if (workSystem === '995') {
    if (/加班|严重|超长|过度|高强度|007|997/.test(t)) return 'high';
    return 'medium';
  }

  if (['965', '加班', '排班'].includes(workSystem)) return 'medium';
  if (workSystem === '955') return 'low';

  return 'unknown';
}

/** 可信度评级 */
export function classifyConfidence(
  section: SectionTitle,
  ruleText: string,
  evidenceList: string[],
): Confidence {
  const evidenceCount = evidenceList.filter(e => e && e.trim()).length;

  if (section === '955') return 'D';
  if (evidenceCount >= 3 && ruleText) return 'A';
  if (evidenceCount >= 1 && ruleText) return 'B';
  if (evidenceCount === 0 && ruleText) return 'C';
  return 'D';
}

// ============================================================
// 分类依据生成 (issue #8) —— 复用上面的规则匹配, 与分类结果保证一致
// ============================================================

/**
 * 生成一条记录的完整分类依据。
 * 注意: 这里复用 matchWorkSystem / matchWeekendKeyword / matchSevereKeywords,
 * 与分类函数走同一份规则表, 因此"分类结果"和"分类依据"永远一致。
 */
export function buildClassificationBasis(
  fullText: string,
  section: SectionTitle,
  workSystem: WorkSystem,
  weekendType: WeekendType,
  riskLevel: RiskLevel,
  ruleAndEvidence: string,
): ClassificationBasis {
  const t = sanitize(fullText);

  // ===== 工作制度依据 =====
  const workDetect = matchWorkSystem(t);
  let workReasons: string[];
  let workSource: ClassificationBasis['workSystem']['source'];

  if (workDetect.system === null) {
    if (section === '955') {
      workReasons = ['该记录位于 Excel "955 正常工作制度公司名单" 区域, 兜底归类为 955'];
      workSource = 'section_fallback';
    } else if (section === '965') {
      workReasons = ['该记录位于 Excel "965 较差工作制度公司名单" 区域, 兜底归类为 965'];
      workSource = 'section_fallback';
    } else if (section === '996') {
      workReasons = ['该记录位于 Excel "996 / 高强度作息记录" 区域, 文本中未匹配到明确制度关键词, 兜底归类为"高强度加班"'];
      workSource = 'section_fallback';
    } else {
      workReasons = ['文本中未匹配到任何作息制度关键词, 也无区域信息'];
      workSource = 'unknown';
    }
  } else {
    workReasons = [`文本中命中关键词: ${workDetect.matched.join('、')}`];
    workSource = 'keyword';
  }

  // ===== 周末类型依据 =====
  let weekendReasons: string[];
  let weekendSource: ClassificationBasis['weekendType']['source'];

  const weekendKw = section === '955' ? null : matchWeekendKeyword(t);

  if (section === '955') {
    weekendReasons = ['该记录位于 955 区域, 955 制度默认双休'];
    weekendSource = 'section_default';
  } else if (weekendKw) {
    const suffix = weekendKw.type === '单休' ? ', 推断为单休' : '';
    weekendReasons = [`文本中命中关键词: ${weekendKw.matched.join('、')}${suffix}`];
    weekendSource = 'keyword';
  } else if (workSystem === '955' || workSystem === '965' || workSystem === '995') {
    weekendReasons = [`工作制度为 ${workSystem} (一周 5 天), 默认推断为双休`];
    weekendSource = 'work_system_inferred';
  } else if (workSystem === '996' || workSystem === '997' || workSystem === '007' || workSystem === '单休') {
    weekendReasons = [`工作制度为 ${workSystem}, 推断为单休`];
    weekendSource = 'work_system_inferred';
  } else if (workSystem === '大小周') {
    weekendReasons = ['工作制度为大小周, 推断为大小周'];
    weekendSource = 'work_system_inferred';
  } else if (workSystem === '排班') {
    weekendReasons = ['工作制度为排班, 推断为排班/轮休'];
    weekendSource = 'work_system_inferred';
  } else {
    weekendReasons = ['文本和制度均无明确周末信息, 保持未知'];
    weekendSource = 'unknown';
  }

  // ===== 强度等级依据 =====
  const re = ruleAndEvidence || '';
  let riskReasons: string[];
  let riskSource: ClassificationBasis['riskLevel']['source'];

  const severeKw = matchSevereKeywords(re);

  if (severeKw.length > 0) {
    riskReasons = [`规则/证据中命中违规关键词: ${severeKw.join('、')}, 直接判定为极高强度`];
    riskSource = 'severe_keyword';
  } else if (['996', '997', '007', '高强度'].includes(workSystem)) {
    riskReasons = [`工作制度为 ${workSystem}, 默认映射为极高强度`];
    riskSource = 'work_system_mapping';
  } else if (['大小周', '单休'].includes(workSystem)) {
    riskReasons = [`工作制度为 ${workSystem}, 默认映射为高强度`];
    riskSource = 'work_system_mapping';
  } else if (workSystem === '995') {
    const extra: string[] = [];
    if (/加班/.test(re)) extra.push('加班');
    if (/严重/.test(re)) extra.push('严重');
    if (/超长/.test(re)) extra.push('超长');
    if (/过度/.test(re)) extra.push('过度');
    if (/高强度/.test(re)) extra.push('高强度');
    if (/007/.test(re)) extra.push('007');
    if (/997/.test(re)) extra.push('997');
    if (extra.length > 0) {
      riskReasons = [`工作制度为 995 (一周 5 天但工作日 12 小时), 且规则/证据命中关键词: ${extra.join('、')}, 升级为高强度`];
    } else {
      riskReasons = ['工作制度为 995 (一周 5 天但工作日 12 小时), 默认中强度'];
    }
    riskSource = 'work_system_mapping';
  } else if (['965', '加班', '排班'].includes(workSystem)) {
    riskReasons = [`工作制度为 ${workSystem}, 默认映射为中强度`];
    riskSource = 'work_system_mapping';
  } else if (workSystem === '955') {
    riskReasons = ['工作制度为 955, 默认映射为低强度'];
    riskSource = 'work_system_mapping';
  } else {
    riskReasons = ['无明确制度或违规关键词, 强度未知'];
    riskSource = 'unknown';
  }

  return {
    workSystem: { label: workSystem, reasons: workReasons, source: workSource },
    weekendType: { label: weekendType, reasons: weekendReasons, source: weekendSource },
    riskLevel: { label: riskLevel, reasons: riskReasons, source: riskSource },
  };
}

// ============================================================
// Excel 日期工具
// ============================================================

/** Excel 数字日期 (e.g. 43556) 转 YYYY-MM-DD */
export function excelDateToString(value: any): string {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    if (!isFinite(value) || value < 1 || value > 60000) return '';
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + value * 86400000);
    return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  }

  const str = String(value).trim();
  if (!str) return '';

  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (num < 1 || num > 60000) return '';
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + num * 86400000);
    return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    if (year >= 1990 && year <= 2100) return d.toISOString().slice(0, 10);
  }

  return '';
}

export { isPureNumber, looksLikeExcelSerialDate, sanitize };
