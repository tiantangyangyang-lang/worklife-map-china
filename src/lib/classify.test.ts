import { describe, it, expect } from 'vitest';
import {
  classifyWorkSystem,
  classifyWeekendType,
  classifyRiskLevel,
  classifyConfidence,
  buildClassificationBasis,
  excelDateToString,
  matchWorkSystem,
  sanitize,
} from './classify';

// ============================================================
// classifyWorkSystem
// ============================================================
describe('classifyWorkSystem', () => {
  it('识别显式作息代号', () => {
    expect(classifyWorkSystem('007', '996')).toBe('007');
    expect(classifyWorkSystem('997', '996')).toBe('997');
    expect(classifyWorkSystem('996', '996')).toBe('996');
    expect(classifyWorkSystem('995', '965')).toBe('995');
    expect(classifyWorkSystem('965', '965')).toBe('965');
    expect(classifyWorkSystem('955', '955')).toBe('955');
  });

  it('识别 996 的同义写法', () => {
    expect(classifyWorkSystem('9106', '996')).toBe('996');
    expect(classifyWorkSystem('早9晚9', '996')).toBe('996');
    expect(classifyWorkSystem('早九晚九', '996')).toBe('996');
  });

  it('识别语义关键词', () => {
    expect(classifyWorkSystem('大小周', '965')).toBe('大小周');
    expect(classifyWorkSystem('做六休一', '965')).toBe('单休');
    expect(classifyWorkSystem('两班倒', '965')).toBe('排班');
    expect(classifyWorkSystem('经常无偿加班', '996')).toBe('加班');
  });

  // issue #1: Excel 日期 serial number 不应误判
  it('issue #1: Excel 日期数字 43556 不应被判成 965/996', () => {
    expect(classifyWorkSystem('43556', '996')).toBe('高强度'); // 兜底, 不是 965
    expect(classifyWorkSystem('某公司 39969 双休', '965')).not.toBe('996');
  });

  it('短代号是长数字的子串时不应误判', () => {
    // "19965" 里含 "965" 但属于长数字, sanitize 后被剔除
    expect(classifyWorkSystem('19965', '965')).toBe('965'); // 兜底到 section, 不是关键词命中
    const detect = matchWorkSystem(sanitize('19965'));
    expect(detect.system).toBeNull();
  });

  it('优先级: 996 先于 965/955', () => {
    expect(classifyWorkSystem('部分岗位 996 部分 955', '996')).toBe('996');
  });

  it('无任何关键词时按 section 兜底', () => {
    expect(classifyWorkSystem('某互联网公司', '955')).toBe('955');
    expect(classifyWorkSystem('某互联网公司', '965')).toBe('965');
    expect(classifyWorkSystem('某互联网公司', '996')).toBe('高强度');
  });
});

// ============================================================
// classifyWeekendType
// ============================================================
describe('classifyWeekendType', () => {
  it('955 区域恒为双休', () => {
    expect(classifyWeekendType('任意文本', '955', '955')).toBe('双休');
  });

  // issue #2: 995 应为双休
  it('issue #2: 995 制度应推断为双休', () => {
    expect(classifyWeekendType('995', '965', '995')).toBe('双休');
  });

  // issue #3: 高强度加班兜底不应默认单休
  it('issue #3: "高强度"兜底分类应保持未知, 不默认单休', () => {
    expect(classifyWeekendType('经常加班强度大', '996', '高强度')).toBe('未知');
  });

  it('显式双休关键词优先于制度推断', () => {
    expect(classifyWeekendType('996但周末双休', '996', '996')).toBe('双休');
  });

  it('996/997/007/单休 推断为单休', () => {
    expect(classifyWeekendType('', '996', '996')).toBe('单休');
    expect(classifyWeekendType('', '996', '单休')).toBe('单休');
  });

  it('大小周 / 排班 正确映射', () => {
    expect(classifyWeekendType('大小周', '965', '大小周')).toBe('大小周');
    expect(classifyWeekendType('两班倒', '965', '排班')).toBe('排班/轮休');
  });
});

// ============================================================
// classifyRiskLevel
// ============================================================
describe('classifyRiskLevel', () => {
  it('违规关键词直接判极高强度', () => {
    expect(classifyRiskLevel('965', '存在拖欠工资情况')).toBe('very_high');
    expect(classifyRiskLevel('955', '强制加班且无加班费')).toBe('very_high');
  });

  it('996/997/007/高强度 → 极高强度', () => {
    expect(classifyRiskLevel('996', '')).toBe('very_high');
    expect(classifyRiskLevel('高强度', '')).toBe('very_high');
  });

  it('大小周/单休 → 高强度', () => {
    expect(classifyRiskLevel('大小周', '')).toBe('high');
    expect(classifyRiskLevel('单休', '')).toBe('high');
  });

  // issue #2: 995 默认中强度, 命中加班升级
  it('issue #2: 995 默认中强度, 命中加班升级为高强度', () => {
    expect(classifyRiskLevel('995', '')).toBe('medium');
    expect(classifyRiskLevel('995', '经常加班')).toBe('high');
  });

  it('965/加班/排班 → 中强度, 955 → 低强度', () => {
    expect(classifyRiskLevel('965', '')).toBe('medium');
    expect(classifyRiskLevel('955', '')).toBe('low');
  });

  it('未知制度无关键词 → unknown', () => {
    expect(classifyRiskLevel('未知', '')).toBe('unknown');
  });
});

// ============================================================
// classifyConfidence
// ============================================================
describe('classifyConfidence', () => {
  it('955 区域恒为 D', () => {
    expect(classifyConfidence('955', '规则', ['a', 'b', 'c'])).toBe('D');
  });
  it('多证据 + 规则 → A', () => {
    expect(classifyConfidence('996', '规则文本', ['e1', 'e2', 'e3'])).toBe('A');
  });
  it('1~2 证据 + 规则 → B', () => {
    expect(classifyConfidence('996', '规则文本', ['e1'])).toBe('B');
  });
  it('仅规则无证据 → C', () => {
    expect(classifyConfidence('996', '规则文本', [])).toBe('C');
  });
  it('空证据中的空白项不计数', () => {
    expect(classifyConfidence('996', '规则文本', ['', '  '])).toBe('C');
  });
});

// ============================================================
// 分类结果 与 分类依据 必须一致 (单一事实来源的核心保证)
// ============================================================
describe('buildClassificationBasis 与分类结果一致', () => {
  const cases: { text: string; section: '955' | '965' | '996' }[] = [
    { text: '996 大小周', section: '996' },
    { text: '995 工作日12小时', section: '965' },
    { text: '某公司 43556 双休', section: '965' },
    { text: '两班倒轮休', section: '965' },
    { text: '经常加班', section: '996' },
    { text: '正常作息', section: '955' },
  ];

  cases.forEach(({ text, section }) => {
    it(`label 字段与分类函数输出一致: "${text}" @${section}`, () => {
      const ws = classifyWorkSystem(text, section);
      const wt = classifyWeekendType(text, section, ws);
      const rl = classifyRiskLevel(ws, text);
      const basis = buildClassificationBasis(text, section, ws, wt, rl, text);

      expect(basis.workSystem.label).toBe(ws);
      expect(basis.weekendType.label).toBe(wt);
      expect(basis.riskLevel.label).toBe(rl);
      // 每个维度都必须给出至少一条理由
      expect(basis.workSystem.reasons.length).toBeGreaterThan(0);
      expect(basis.weekendType.reasons.length).toBeGreaterThan(0);
      expect(basis.riskLevel.reasons.length).toBeGreaterThan(0);
    });
  });

  it('命中关键词时 source 为 keyword 且列出关键词', () => {
    const basis = buildClassificationBasis('996', '996', '996', '单休', 'very_high', '');
    expect(basis.workSystem.source).toBe('keyword');
    expect(basis.workSystem.reasons[0]).toContain('996');
  });
});

// ============================================================
// excelDateToString
// ============================================================
describe('excelDateToString', () => {
  it('空值返回空串', () => {
    expect(excelDateToString('')).toBe('');
    expect(excelDateToString(null)).toBe('');
    expect(excelDateToString(undefined)).toBe('');
  });
  it('Excel serial number 转日期', () => {
    // 43556 ≈ 2019-04-01
    expect(excelDateToString(43556)).toBe('2019-04-01');
    expect(excelDateToString('43556')).toBe('2019-04-01');
  });
  it('超范围数字返回空串', () => {
    expect(excelDateToString(99999)).toBe('');
    expect(excelDateToString(0)).toBe('');
  });
  it('ISO 字符串可解析', () => {
    expect(excelDateToString('2023-05-01')).toBe('2023-05-01');
  });
  it('无法解析的文本返回空串', () => {
    expect(excelDateToString('不是日期')).toBe('');
  });
});

// ============================================================
// sanitize
// ============================================================
describe('sanitize', () => {
  it('剔除 ≥4 位数字, 保留 2~3 位代号', () => {
    expect(sanitize('43556')).not.toContain('4355');
    expect(sanitize('996')).toContain('996');
    expect(sanitize('965')).toContain('965');
  });
  it('转小写', () => {
    expect(sanitize('Remote')).toBe('remote');
  });
});
