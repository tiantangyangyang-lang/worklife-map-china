// ============================================================
// 浏览器端 Excel 解析 (基于 xlsx 库)
// ============================================================
import * as XLSX from 'xlsx';
import type { CompanyRecord } from './types';
import { parseSheetRows } from './normalize';

/**
 * 抽取一个 sheet 的单元格超链接, 返回与 sheet_to_json(header:1) 行列对齐的二维数组:
 *   links[r][c] = 该单元格的超链接目标 (cell.l.Target), 无链接为 undefined。
 * xlsx 解析 .xlsx 时会把超链接读入 cell.l.Target, 但 sheet_to_json 只取 .v 值会丢掉它,
 * 因此这里单独扫描原始 sheet 对象补回来。
 */
function extractCellLinks(sheet: XLSX.WorkSheet): string[][] {
  const links: string[][] = [];
  const ref = sheet['!ref'];
  if (!ref) return links;
  const range = XLSX.utils.decode_range(ref);
  for (const addr in sheet) {
    if (addr[0] === '!') continue;
    const cell = sheet[addr] as XLSX.CellObject;
    const target = cell?.l?.Target;
    if (!target) continue;
    const { r, c } = XLSX.utils.decode_cell(addr);
    // sheet_to_json(header:1) 的行从 range.s.r 起算为第 0 行
    const rr = r - range.s.r;
    const cc = c - range.s.c;
    if (rr < 0 || cc < 0) continue;
    if (!links[rr]) links[rr] = [];
    links[rr][cc] = target;
  }
  return links;
}

/**
 * 从 File 对象解析 Excel, 返回标准化公司记录数组
 */
export async function parseExcelFile(file: File): Promise<CompanyRecord[]> {
  const buffer = await file.arrayBuffer();
  return parseWorkbook(buffer, file.name);
}

/**
 * 解析 ArrayBuffer (用于 fetch 已下载的文件)
 */
export function parseExcelBuffer(buffer: ArrayBuffer, fileName: string): CompanyRecord[] {
  return parseWorkbook(buffer, fileName);
}

/** 解析整个 workbook (File / ArrayBuffer 共用) */
function parseWorkbook(buffer: ArrayBuffer, fileName: string): CompanyRecord[] {
  // cellHTML:false 减少开销; 超链接默认会读入 cell.l, 无需额外开关
  const workbook = XLSX.read(buffer, { type: 'array' });
  const allRecords: CompanyRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    const links = extractCellLinks(sheet);
    const records = parseSheetRows(rows, fileName, sheetName, links);
    allRecords.push(...records);
  }

  return allRecords;
}
