// ============================================================
// 浏览器端 Excel 解析 (基于 xlsx 库)
// ============================================================
import * as XLSX from 'xlsx';
import type { CompanyRecord } from './types';
import { parseSheetRows } from './normalize';

/**
 * 从 File 对象解析 Excel, 返回标准化公司记录数组
 */
export async function parseExcelFile(file: File): Promise<CompanyRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const allRecords: CompanyRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    const records = parseSheetRows(rows, file.name, sheetName);
    allRecords.push(...records);
  }

  return allRecords;
}

/**
 * 解析 ArrayBuffer (用于 fetch 已下载的文件)
 */
export function parseExcelBuffer(buffer: ArrayBuffer, fileName: string): CompanyRecord[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const allRecords: CompanyRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    const records = parseSheetRows(rows, fileName, sheetName);
    allRecords.push(...records);
  }

  return allRecords;
}
