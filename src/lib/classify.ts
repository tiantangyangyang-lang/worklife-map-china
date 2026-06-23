// ============================================================
// 作息自动分类规则
// ============================================================
import type { WorkSystem, WeekendType, RiskLevel, SectionTitle, Confidence, ClassificationBasis } from './types';

/**
 * 判断字符串是否为纯数字 (含 Excel serial date 形如 43556, 或纯数字编号)
 * 用于避免把数字编号 / Excel 日期数字误判为 996 / 995 / 965 等
 */
function isPureNumber(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

/**
 * 判断字符串是否看起来像 Excel 数字日期 (1900-01-01 至 2100-12-31 之间的整数)
 * Excel serial date 1900-01-01 ≈ 1, 2100-12-31 ≈ 73415
 */
function looksLikeExcelSerialDate(s: string): boolean {
  const n = parseInt(s.trim(), 10);
  return !isNaN(n) && n >= 1 && n <= 80000;
}

/**
 * 工作制度识别
 *
 * 关键修复 (issue #1):
 *   在判断 007/997/996/995/965/955 等数字代号时, 先剔除字段里的纯数字片段
 *   (这些片段通常是 Excel 日期 serial number 如 43556、或记录编号如 39969),
 *   只在"看起来像作息描述"的文本里匹配。否则会出现 43556 → 含 965? 误判等情况。
 *
 *   具体策略: 把整段文本按空白拆分, 凡是纯数字 (尤其是 Excel 日期范围内的数字) 都剔除,
 *   再用剩下的"语义文本"做关键词匹配。
 */
export function classifyWorkSystem(text: string, section: SectionTitle): WorkSystem {
  const raw = (text || '').toLowerCase();

  // 拆分后剔除纯数字 token (Excel 日期 / 记录编号 / 时间戳), 只保留语义文本
  const semanticTokens = raw
    .split(/[\s,，;；|/]+/)
    .filter(tok => {
      if (!tok) return false;
      // 纯数字 token: 全部剔除 (Excel 日期、ID、年份等都不应该参与作息关键词匹配)
      if (isPureNumber(tok)) return false;
      // 形如 "955" / "996" 这种短数字串会被识别为作息代号, 必须保留
      // 上面 isPureNumber 已经把所有纯数字剔除, 但作息代号本身就是纯数字...
      // 所以这里改为: 只剔除"长数字" (≥4 位), 保留 2~3 位的短数字 (可能是 955/996/965 等)
      return true;
    });

  // 单独处理: 短数字代号必须显式出现 (避免长数字里隐含 996 子串)
  // 重新构造一个"安全文本": 把所有长度 ≥4 的数字 token 替换为空格
  const safeText = raw.replace(/\b\d{4,}\b/g, ' ').replace(/(\d{4,})/g, ' ');
  // 再拼接一次 (确保中文环境下的数字也被处理)
  const t = safeText;

  // 显式作息代号匹配 (短数字串必须独立出现, 不能是长数字的子串)
  // \b 在中文环境下不可靠, 改用 (?<!\d) ... (?!\d) 负向断言
  if (/(?<!\d)007(?!\d)/.test(t)) return '007';
  if (/(?<!\d)997(?!\d)/.test(t)) return '997';
  if (/(?<!\d)996(?!\d)/.test(t) || /9106|早9晚9|早九晚九|11116/.test(t)) return '996';
  if (/(?<!\d)995(?!\d)/.test(t)) return '995';
  if (/(?<!\d)965(?!\d)/.test(t) || /9-6-5|9:00-18:00-5|9点.*6点.*5|9:00-5:30-5|915-530-5|9:30-17:30-5/.test(t)) return '965';
  if (/(?<!\d)955(?!\d)/.test(t) || /9-5-5|9:00-17:00-5/.test(t)) return '955';

  // 语义关键词 (不依赖数字)
  if (/大小周|单双休/.test(t)) return '大小周';
  if (/单休|做六休一|上六休一|一周6天|一周7天|周六加班/.test(t)) return '单休';
  if (/排班|轮休|倒班|两班倒/.test(t)) return '排班';
  if (/加班|义务加班|无偿加班/.test(t)) return '加班';

  // 兜底: 按 section 默认归类
  if (section === '955') return '955';
  if (section === '965') return '965';
  if (section === '996') return '高强度';

  return '未知';
}

/**
 * 周末休息类型识别
 *
 * 关键修复 (issue #2): 995 (9 点-9 点-5 天) 应为 "双休"
 *   - 995 表示工作日 9 点上班、9 点下班、一周 5 天, 即工作日长工时但周末双休
 *   - 旧逻辑没显式处理 995, 会落到 workSystem === '995' 的推断分支, 但旧推断分支没列 995
 *     实际会落到 default '未知', 这里显式返回 '双休'
 *
 * 关键修复 (issue #3): 高强度加班不要默认推断为单休
 *   - 旧逻辑: workSystem === '高强度' 也被推断为 '单休' → 不合理
 *   - 新逻辑: 只有明确出现 996 / 9106 / 一周6天 / 周六加班 / 997 / 007 时才判断为单休
 *   - "高强度加班" 这种兜底分类只表示工时长, 不一定意味着周末也要上班, 应保持 '未知'
 */
export function classifyWeekendType(text: string, section: SectionTitle, workSystem: WorkSystem): WeekendType {
  const raw = text || '';

  // 同 classifyWorkSystem: 把长数字 token 替换掉, 避免 43556 这类数字干扰
  const t = raw.replace(/\d{4,}/g, ' ');

  if (section === '955') return '双休';

  // 显式关键词优先
  if (/双休|周末双休|做五休二|五天工作制/.test(t)) return '双休';
  if (/大小周|单双休/.test(t)) return '大小周';
  if (/排班|轮休|倒班|两班倒/.test(t)) return '排班/轮休';

  // 关键修复 (issue #3): 只有明确出现这些关键词才判断为单休
  // 996 / 9106 / 一周6天 / 周六加班 / 997 / 007
  // 注意: 此处必须用安全文本 t (已剔除长数字), 避免数字编号误判
  if (/(?<!\d)996(?!\d)/.test(t) || /9106/.test(t) || /一周6天|周六加班/.test(t) ||
      /(?<!\d)997(?!\d)/.test(t) || /(?<!\d)007(?!\d)/.test(t) ||
      /单休|做六休一|上六休一/.test(t)) {
    return '单休';
  }

  // 根据 work_system 推断 (仅对明确的制度, 不再推断 "高强度" / "加班" → 单休)
  if (workSystem === '955' || workSystem === '965' || workSystem === '995') return '双休';
  if (workSystem === '996' || workSystem === '997' || workSystem === '007' || workSystem === '单休') return '单休';
  if (workSystem === '大小周') return '大小周';
  if (workSystem === '排班') return '排班/轮休';

  // 兜底: 不再因为 "高强度加班" 默认推断为单休, 保持未知
  return '未知';
}

/**
 * 工作强度等级识别 (内部字段名仍为 risk_level, UI 文案为"工作强度等级")
 *
 * 关键修复 (issue #2): 995 工作制度应保持中强度或高强度 (而不是被推到 unknown)
 *   - 995 一周 5 天 × 每天 12 小时, 工作日工时很长, 但周末双休, 整体属于中强度偏上
 *   - 若规则文本里出现"加班/义务加班/无偿加班"等更严重关键词, 升级为高强度
 */
export function classifyRiskLevel(workSystem: WorkSystem, text: string): RiskLevel {
  const t = text || '';

  // 极高强度关键词 (违规行为相关, 自动归为 very_high)
  if (/拖欠工资|无偿加班|无加班费|裁员无补偿|强制996|强制加班|严重违法|猝死|降薪/.test(t)) {
    return 'very_high';
  }

  if (['996', '997', '007', '高强度'].includes(workSystem)) return 'very_high';
  if (['大小周', '单休'].includes(workSystem)) return 'high';

  // 995: 默认中强度, 但如果规则/证据里有"加班/严重/超长"等关键词, 升级为高强度
  if (workSystem === '995') {
    if (/加班|严重|超长|过度|高强度|007|997/.test(t)) return 'high';
    return 'medium';
  }

  if (['965', '加班', '排班'].includes(workSystem)) return 'medium';
  if (workSystem === '955') return 'low';

  return 'unknown';
}

/**
 * 可信度评级
 */
export function classifyConfidence(
  section: SectionTitle,
  ruleText: string,
  evidenceList: string[],
): Confidence {
  const evidenceCount = evidenceList.filter(e => e && e.trim()).length;

  // 955 区域只有城市和公司名, 默认 D
  if (section === '955') return 'D';

  // 多条证据 + 明确规则
  if (evidenceCount >= 3 && ruleText) return 'A';
  // 有规则和证据描述
  if (evidenceCount >= 1 && ruleText) return 'B';
  // 只有单条记录
  if (evidenceCount === 0 && ruleText) return 'C';

  return 'D';
}

/**
 * 生成"分类依据"说明 (issue #8)
 * 解释为什么这条记录被判断为某种工作制度、周末类型、强度等级。
 * 返回值会展示在公司详情页的"分类依据"模块。
 */
// ClassificationBasis 类型从 ./types 导入 (避免重复定义)

/**
 * 内部辅助: 重新执行一次 work_system 的关键词检测, 返回命中的关键词列表
 */
function detectWorkSystemKeywords(t: string): { system: WorkSystem | null; matched: string[] } {
  const matched: string[] = [];

  if (/(?<!\d)007(?!\d)/.test(t)) { matched.push('007'); return { system: '007', matched }; }
  if (/(?<!\d)997(?!\d)/.test(t)) { matched.push('997'); return { system: '997', matched }; }
  if (/(?<!\d)996(?!\d)/.test(t)) { matched.push('996'); }
  if (/9106/.test(t)) matched.push('9106');
  if (/早9晚9|早九晚九/.test(t)) matched.push('早9晚9');
  if (/11116/.test(t)) matched.push('11116');
  if (matched.length > 0) return { system: '996', matched };

  if (/(?<!\d)995(?!\d)/.test(t)) { matched.push('995'); return { system: '995', matched }; }

  if (/(?<!\d)965(?!\d)/.test(t)) matched.push('965');
  if (/9-6-5/.test(t)) matched.push('9-6-5');
  if (/9:00-18:00-5/.test(t)) matched.push('9:00-18:00-5');
  if (/9点.*6点.*5/.test(t)) matched.push('9点…6点…5');
  if (/9:00-5:30-5/.test(t)) matched.push('9:00-5:30-5');
  if (/915-530-5/.test(t)) matched.push('915-530-5');
  if (/9:30-17:30-5/.test(t)) matched.push('9:30-17:30-5');
  if (matched.length > 0) return { system: '965', matched };

  if (/(?<!\d)955(?!\d)/.test(t)) matched.push('955');
  if (/9-5-5/.test(t)) matched.push('9-5-5');
  if (/9:00-17:00-5/.test(t)) matched.push('9:00-17:00-5');
  if (matched.length > 0) return { system: '955', matched };

  if (/大小周|单双休/.test(t)) {
    if (/大小周/.test(t)) matched.push('大小周');
    if (/单双休/.test(t)) matched.push('单双休');
    return { system: '大小周', matched };
  }
  if (/单休|做六休一|上六休一|一周6天|一周7天|周六加班/.test(t)) {
    if (/单休/.test(t)) matched.push('单休');
    if (/做六休一|上六休一/.test(t)) matched.push('做六休一/上六休一');
    if (/一周6天|一周7天/.test(t)) matched.push('一周6/7天');
    if (/周六加班/.test(t)) matched.push('周六加班');
    return { system: '单休', matched };
  }
  if (/排班|轮休|倒班|两班倒/.test(t)) {
    if (/排班/.test(t)) matched.push('排班');
    if (/轮休/.test(t)) matched.push('轮休');
    if (/倒班|两班倒/.test(t)) matched.push('倒班/两班倒');
    return { system: '排班', matched };
  }
  if (/加班|义务加班|无偿加班/.test(t)) {
    if (/义务加班/.test(t)) matched.push('义务加班');
    if (/无偿加班/.test(t)) matched.push('无偿加班');
    if (/加班/.test(t)) matched.push('加班');
    return { system: '加班', matched };
  }

  return { system: null, matched: [] };
}

/**
 * 生成一条记录的完整分类依据
 * @param fullText       完整文本 (城市 + 公司 + 时间 + 规则 + 证据)
 * @param section        Excel 中所属区域 (955 / 965 / 996)
 * @param workSystem     已分类的工作制度
 * @param weekendType    已分类的周末类型
 * @param riskLevel      已分类的强度等级
 * @param ruleAndEvidence 仅规则 + 证据文本 (用于 risk_level 关键词匹配)
 */
export function buildClassificationBasis(
  fullText: string,
  section: SectionTitle,
  workSystem: WorkSystem,
  weekendType: WeekendType,
  riskLevel: RiskLevel,
  ruleAndEvidence: string,
): ClassificationBasis {
  const raw = (fullText || '').toLowerCase();
  const safeText = raw.replace(/\d{4,}/g, ' ');
  const t = safeText;

  // ===== 工作制度依据 =====
  const workDetect = detectWorkSystemKeywords(t);
  let workReasons: string[] = workDetect.matched;
  let workSource: ClassificationBasis['workSystem']['source'] = 'keyword';

  if (workDetect.system === null) {
    // 关键词没命中, 说明是兜底逻辑
    if (section === '955') {
      workReasons = [`该记录位于 Excel "955 正常工作制度公司名单" 区域, 兜底归类为 955`];
      workSource = 'section_fallback';
    } else if (section === '965') {
      workReasons = [`该记录位于 Excel "965 较差工作制度公司名单" 区域, 兜底归类为 965`];
      workSource = 'section_fallback';
    } else if (section === '996') {
      workReasons = [`该记录位于 Excel "996 / 高强度作息记录" 区域, 文本中未匹配到明确制度关键词, 兜底归类为"高强度加班"`];
      workSource = 'section_fallback';
    } else {
      workReasons = ['文本中未匹配到任何作息制度关键词, 也无区域信息'];
      workSource = 'unknown';
    }
  } else {
    workReasons = [`文本中命中关键词: ${workDetect.matched.join('、')}`];
  }

  // ===== 周末类型依据 =====
  let weekendReasons: string[] = [];
  let weekendSource: ClassificationBasis['weekendType']['source'] = 'unknown';

  if (section === '955') {
    weekendReasons = [`该记录位于 955 区域, 955 制度默认双休`];
    weekendSource = 'section_default';
  } else if (/双休|周末双休|做五休二|五天工作制/.test(t)) {
    const kw: string[] = [];
    if (/双休|周末双休/.test(t)) kw.push('双休');
    if (/做五休二/.test(t)) kw.push('做五休二');
    if (/五天工作制/.test(t)) kw.push('五天工作制');
    weekendReasons = [`文本中命中关键词: ${kw.join('、')}`];
    weekendSource = 'keyword';
  } else if (/大小周|单双休/.test(t)) {
    weekendReasons = [`文本中命中关键词: 大小周/单双休`];
    weekendSource = 'keyword';
  } else if (/排班|轮休|倒班|两班倒/.test(t)) {
    weekendReasons = [`文本中命中关键词: 排班/轮休/倒班`];
    weekendSource = 'keyword';
  } else if (/(?<!\d)996(?!\d)/.test(t) || /9106/.test(t) || /一周6天|周六加班/.test(t) ||
             /(?<!\d)997(?!\d)/.test(t) || /(?<!\d)007(?!\d)/.test(t) ||
             /单休|做六休一|上六休一/.test(t)) {
    const kw: string[] = [];
    if (/(?<!\d)996(?!\d)/.test(t)) kw.push('996');
    if (/9106/.test(t)) kw.push('9106');
    if (/一周6天/.test(t)) kw.push('一周6天');
    if (/周六加班/.test(t)) kw.push('周六加班');
    if (/(?<!\d)997(?!\d)/.test(t)) kw.push('997');
    if (/(?<!\d)007(?!\d)/.test(t)) kw.push('007');
    if (/单休|做六休一|上六休一/.test(t)) kw.push('单休/做六休一');
    weekendReasons = [`文本中命中关键词: ${kw.join('、')}, 推断为单休`];
    weekendSource = 'keyword';
  } else if (workSystem === '955' || workSystem === '965' || workSystem === '995') {
    weekendReasons = [`工作制度为 ${workSystem} (一周 5 天), 默认推断为双休`];
    weekendSource = 'work_system_inferred';
  } else if (workSystem === '996' || workSystem === '997' || workSystem === '007' || workSystem === '单休') {
    weekendReasons = [`工作制度为 ${workSystem}, 推断为单休`];
    weekendSource = 'work_system_inferred';
  } else if (workSystem === '大小周') {
    weekendReasons = [`工作制度为大小周, 推断为大小周`];
    weekendSource = 'work_system_inferred';
  } else if (workSystem === '排班') {
    weekendReasons = [`工作制度为排班, 推断为排班/轮休`];
    weekendSource = 'work_system_inferred';
  } else {
    weekendReasons = ['文本和制度均无明确周末信息, 保持未知'];
    weekendSource = 'unknown';
  }

  // ===== 强度等级依据 =====
  const re = (ruleAndEvidence || '');
  let riskReasons: string[] = [];
  let riskSource: ClassificationBasis['riskLevel']['source'] = 'unknown';

  const severeKw: string[] = [];
  if (/拖欠工资/.test(re)) severeKw.push('拖欠工资');
  if (/无偿加班/.test(re)) severeKw.push('无偿加班');
  if (/无加班费/.test(re)) severeKw.push('无加班费');
  if (/裁员无补偿/.test(re)) severeKw.push('裁员无补偿');
  if (/强制996/.test(re)) severeKw.push('强制996');
  if (/强制加班/.test(re)) severeKw.push('强制加班');
  if (/严重违法/.test(re)) severeKw.push('严重违法');
  if (/猝死/.test(re)) severeKw.push('猝死');
  if (/降薪/.test(re)) severeKw.push('降薪');

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
      riskReasons = [`工作制度为 995 (一周 5 天但工作日 12 小时), 默认中强度`];
    }
    riskSource = 'work_system_mapping';
  } else if (['965', '加班', '排班'].includes(workSystem)) {
    riskReasons = [`工作制度为 ${workSystem}, 默认映射为中强度`];
    riskSource = 'work_system_mapping';
  } else if (workSystem === '955') {
    riskReasons = [`工作制度为 955, 默认映射为低强度`];
    riskSource = 'work_system_mapping';
  } else {
    riskReasons = ['无明确制度或违规关键词, 强度未知'];
    riskSource = 'unknown';
  }

  return {
    workSystem: {
      label: workSystem,
      reasons: workReasons,
      source: workSource,
    },
    weekendType: {
      label: weekendType,
      reasons: weekendReasons,
      source: weekendSource,
    },
    riskLevel: {
      label: riskLevel,
      reasons: riskReasons,
      source: riskSource,
    },
  };
}

/** Excel 数字日期 (e.g. 43556) 转 YYYY-MM-DD */
export function excelDateToString(value: any): string {
  if (value === null || value === undefined || value === '') return '';

  // 数字类型: Excel serial date
  if (typeof value === 'number') {
    if (!isFinite(value) || value < 1 || value > 60000) return '';
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + value * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '';
  }

  const str = String(value).trim();
  if (!str) return '';

  // 纯数字字符串: 当作 Excel serial date
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (num < 1 || num > 60000) return ''; // 范围外不解析
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + num * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '';
  }

  // ISO 字符串: 尝试 Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    if (year >= 1990 && year <= 2100) {
      return d.toISOString().slice(0, 10);
    }
  }

  // 无法解析, 返回空 (而不是原始字符串, 避免 UI 显示混乱)
  return '';
}

// 防止 looksLikeExcelSerialDate 被 tree-shake 警告 (保留为导出, 供其它模块测试)
export { isPureNumber, looksLikeExcelSerialDate };
