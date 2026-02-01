const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ejemplo_xlsx.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== HOJAS ===', workbook.SheetNames);
console.log('');

workbook.SheetNames.forEach((sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  console.log('=== HOJA:', sheetName, '===');
  console.log(JSON.stringify(data, null, 2));
  console.log('');
});
