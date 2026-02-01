const fs = require('fs');
const path = require('path');
const { parsePresupuestoExcel } = require('../src/parseExcel');
const { generatePresupuestoPdf } = require('../src/generatePdf');

async function main() {
  const buffer = fs.readFileSync(path.join(__dirname, '..', 'ejemplo_xlsx.xlsx'));
  const data = parsePresupuestoExcel(buffer);
  const pdfBytes = await generatePresupuestoPdf(data);
  const outPath = path.join(__dirname, '..', 'salida-test.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log('PDF generado:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
