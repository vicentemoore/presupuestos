const fs = require('fs');
const path = require('path');
const { parsePresupuestoExcel } = require('../src/parseExcel');

const buffer = fs.readFileSync(path.join(__dirname, '..', 'ejemplo_xlsx.xlsx'));
const data = parsePresupuestoExcel(buffer);
console.log(JSON.stringify(data, null, 2));
