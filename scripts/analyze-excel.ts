import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/home/z/my-project/upload/中国公司守法情况.xlsx';
const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer' });

console.log('=== Sheet Names ===');
console.log(workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  console.log(`Total rows: ${rows.length}`);
  console.log('\n--- First 60 rows ---');
  rows.slice(0, 60).forEach((row, i) => {
    const rowStr = row.map((c: any) => String(c).replace(/\n/g, ' ').slice(0, 40)).join(' | ');
    console.log(`Row ${i + 1}: ${rowStr}`);
  });
  console.log('\n--- Last 10 rows ---');
  rows.slice(-10).forEach((row, i) => {
    const rowStr = row.map((c: any) => String(c).replace(/\n/g, ' ').slice(0, 40)).join(' | ');
    console.log(`Row ${rows.length - 10 + i + 1}: ${rowStr}`);
  });
}
