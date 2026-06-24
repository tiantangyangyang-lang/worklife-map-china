// ============================================================
// 生成 V2 样例 Excel 模板 (含公司点位字段)
// 用法: bun run scripts/generate-sample-template.ts
// ============================================================
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', '中国公司作息情况.example.v2.xlsx');

// 表头
const HEADERS_955 = ['城市', '公司'];
const HEADERS_965_996 = ['城市', '公司', '时间', '规则', '证据1', '证据2', '证据3', '证据4', '省份', '区县', '详细地址', '经度', '纬度', '坐标系'];

// 示例数据
const DATA_955: (string|number)[][] = [
  ['北京', '示例科技（北京）有限公司'],
  ['上海', '示例金融信息服务（上海）有限公司'],
  ['深圳', '示例互联网技术有限公司'],
];

const DATA_965: (string|number)[][] = [
  ['北京', '示例网络科技（北京）有限公司', '2024-01-15', '965;中午休息2小时', '脉脉帖子', '', '', '', '北京市', '海淀区', '中关村大街1号', 116.314, 39.984, 'gcj02'],
  ['上海', '示例软件科技（上海）有限公司', '2024-02-20', '9:00-18:00-5', '知乎回答', '', '', '', '上海市', '浦东新区', '张江高科技园区', 121.599, 31.205, 'gcj02'],
  ['深圳', '示例通信技术有限公司', '2024-03-10', '965', '看准网', '', '', '', '广东省', '南山区', '科技园南区', 113.943, 22.534, 'gcj02'],
];

const DATA_996: (string|number)[][] = [
  ['北京', '示例互联网有限公司', '2024-01-20', '996', '脉脉帖子', '加班记录', '', '', '北京市', '朝阳区', '望京SOHO', 116.481, 39.996, 'gcj02'],
  ['上海', '示例电商技术有限公司', '2024-02-25', '996;大小周', '知乎回答', '内部截图', '', '', '上海市', '黄浦区', '南京东路', 121.474, 31.232, 'gcj02'],
  ['杭州', '示例网络科技有限公司', '2024-03-15', '997', '看准网', '考勤记录', '脉脉帖子', '', '浙江省', '西湖区', '文三路', 120.130, 30.260, 'gcj02'],
  ['北京', '示例科技有限公司', '2024-04-01', '996', '脉脉帖子', '', '', '', '', '', '', '', ''], // 无经纬度, 退回城市级
];

// 构造 sheet 数据
const sheetData: (string|number)[][] = [
  ['955正常工作制度公司名单'],
  ...HEADERS_955.map((_, i) => i === 0 ? HEADERS_955 : []),
  ...DATA_955,
  [''],
  ['965较差工作制度公司名单'],
  HEADERS_965_996,
  ...DATA_965,
  [''],
  ['996...公司高强度作息记录'],
  HEADERS_965_996,
  ...DATA_996,
];

// 创建 workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(sheetData);
XLSX.utils.book_append_sheet(wb, ws, 'company_schedule');

// 写入文件
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
XLSX.writeFile(wb, OUTPUT_FILE);

console.log(`✅ V2 样例 Excel 已生成: ${OUTPUT_FILE}`);
console.log(`   大小: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
console.log(`   包含: 955 区域 ${DATA_955.length} 条, 965 区域 ${DATA_965.length} 条, 996 区域 ${DATA_996.length} 条`);
console.log(`   其中 996 区域最后 1 条无经纬度 (测试 fallback 到城市级)`);
