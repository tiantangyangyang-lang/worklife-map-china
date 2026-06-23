// ============================================================
// 作息自动分类规则
// ============================================================
import type { WorkSystem, WeekendType, RiskLevel, SectionTitle, Confidence } from './types';

/** 工作制度识别 */
export function classifyWorkSystem(text: string, section: SectionTitle): WorkSystem {
  const t = (text || '').toLowerCase();

  if (/007/.test(t)) return '007';
  if (/997/.test(t)) return '997';
  if (/996|9106|早9晚9|早九晚九|11116/.test(t)) return '996';
  if (/995/.test(t)) return '995';
  if (/965|9-6-5|9:00-18:00-5|9点.*6点.*5|9:00-5:30-5|915-530-5|9:30-17:30-5/.test(t)) return '965';
  if (/955|9-5-5|9:00-17:00-5/.test(t)) return '955';
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

/** 周末休息类型识别 */
export function classifyWeekendType(text: string, section: SectionTitle, workSystem: WorkSystem): WeekendType {
  const t = text || '';

  if (section === '955') return '双休';
  if (/双休|周末双休|做五休二|五天工作制/.test(t)) return '双休';
  if (/大小周|单双休/.test(t)) return '大小周';
  if (/单休|做六休一|上六休一|一周6天|周六加班|9106|996|997|007/.test(t)) return '单休';
  if (/排班|轮休|倒班|两班倒/.test(t)) return '排班/轮休';

  // 根据 work_system 推断
  if (workSystem === '955' || workSystem === '965') return '双休';
  if (workSystem === '996' || workSystem === '997' || workSystem === '007' || workSystem === '单休' || workSystem === '高强度') return '单休';
  if (workSystem === '大小周') return '大小周';
  if (workSystem === '排班') return '排班/轮休';

  return '未知';
}

/** 工作强度等级识别 (内部字段名仍为 risk_level, UI 文案为"工作强度等级") */
export function classifyRiskLevel(workSystem: WorkSystem, text: string): RiskLevel {
  const t = text || '';

  // 极高强度关键词 (违规行为相关, 自动归为 very_high)
  if (/拖欠工资|无偿加班|无加班费|裁员无补偿|强制996|强制加班|严重违法|猝死|降薪/.test(t)) {
    return 'very_high';
  }

  if (['996', '997', '007', '高强度'].includes(workSystem)) return 'very_high';
  if (['大小周', '单休'].includes(workSystem)) return 'high';
  if (['965', '995', '加班', '排班'].includes(workSystem)) return 'medium';
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
