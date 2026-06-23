import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = '/home/z/my-project/upload/中国公司守法情况.xlsx';
const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer' });
const sheet = workbook.Sheets['996_lists'];
const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

// Find section headers - rows that contain text but only in column 0
console.log('=== Section Headers Found ===');
rows.forEach((row, i) => {
  const col0 = String(row[0] || '').trim();
  const col1 = String(row[1] || '').trim();
  const col2 = String(row[2] || '').trim();
  const col3 = String(row[3] || '').trim();
  // Detect header-like rows
  if ((col0.includes('955') || col0.includes('965') || col0.includes('996')) && !col1 && !col2) {
    console.log(`Row ${i + 1}: SECTION = "${col0}"`);
  }
  // Detect header rows with city/company columns
  if (col0 === '城市' || col0 === '城市 ' || (col0 === '城市' && col1 === '公司')) {
    console.log(`Row ${i + 1}: HEADER = "${col0}" | "${col1}" | "${col2}" | "${col3}"`);
  }
});

console.log('\n=== Rows 85-115 (transition zone) ===');
rows.slice(84, 115).forEach((row, i) => {
  const rowStr = row.slice(0, 5).map((c: any) => String(c).replace(/\n/g, ' ').slice(0, 50)).join(' | ');
  console.log(`Row ${85 + i}: ${rowStr}`);
});

console.log('\n=== Rows 95-115 ===');
rows.slice(94, 115).forEach((row, i) => {
  const rowStr = row.slice(0, 5).map((c: any) => String(c).replace(/\n/g, ' ').slice(0, 50)).join(' | ');
  console.log(`Row ${95 + i}: ${rowStr}`);
});

// Count records in each section by detecting city/company patterns
let section955 = 0, section965 = 0, section996 = 0;
let currentSection = '';
rows.forEach((row) => {
  const col0 = String(row[0] || '').trim();
  const col1 = String(row[1] || '').trim();
  if (col0.includes('955') && !col1) currentSection = '955';
  else if (col0.includes('965') && !col1) currentSection = '965';
  else if (col0.includes('996') && !col1) currentSection = '996';
  else if (col0 && col0 !== '城市' && col1 && col1 !== '公司') {
    if (currentSection === '955') section955++;
    else if (currentSection === '965') section965++;
    else if (currentSection === '996') section996++;
  }
});
console.log(`\n=== Counts ===\n955: ${section955}\n965: ${section965}\n996: ${section996}\nTotal: ${section955 + section965 + section996}`);

// Unique cities
const citySet = new Set<string>();
rows.forEach((row) => {
  const col0 = String(row[0] || '').trim();
  if (col0 && col0 !== '城市' && !col0.includes('955') && !col0.includes('965') && !col0.includes('996')) {
    // split multi-city entries
    const cities = col0.split(/[\/,\-，、]/).map(s => s.trim()).filter(Boolean);
    cities.forEach(c => citySet.add(c));
  }
});
console.log(`\n=== Unique Cities (${citySet.size}) ===`);
console.log(Array.from(citySet).sort().join(', '));
