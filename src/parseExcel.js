const XLSX = require('xlsx');

/**
 * Parsea la hoja "Table 1" del Excel y extrae repuestos, mano de obra y totales.
 * Espera columnas: REPUESTOS/MANO DE OBRA (A), CANTIDAD (B), PRECIO (C), TOTAL (D).
 */
function parsePresupuestoExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find((n) => n === 'Table 1') || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const repuestos = [];
  const manoDeObra = [];
  let totalRepuestos = null;
  let totalManoDeObra = null;
  let totalPresupuesto = null;
  let depositoInicial = null;

  let section = null; // 'repuestos' | 'mano de obra'

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const a = String(row[0] ?? '').trim();
    const b = String(row[1] ?? '').trim();
    const d = row[3]; // total numérico

    if (a === 'REPUESTOS') {
      section = 'repuestos';
      continue;
    }
    if (a === 'MANO DE OBRA') {
      section = 'mano de obra';
      continue;
    }

    if (section === 'repuestos') {
      const totalMatch = b.match(/TOTAL REPUESTOS\s*\$\s*([\d.,]+)/i);
      if (totalMatch) {
        totalRepuestos = parseTotal(totalMatch[1]);
        section = null;
        continue;
      }
      if (a && typeof d === 'number' && !isNaN(d)) {
        repuestos.push({ descripcion: a, valorTotal: d });
      }
    }

    if (section === 'mano de obra') {
      const totalMatch = b.match(/TOTAL MANO DE OBRA\s*\$\s*([\d.,]+)/i);
      if (totalMatch) {
        totalManoDeObra = parseTotal(totalMatch[1]);
        section = null;
        continue;
      }
      if (a && typeof d === 'number' && !isNaN(d)) {
        manoDeObra.push({ descripcion: a, valorTotal: d });
      }
    }

    // Totales finales (línea tipo "DEPOSITO..." y "TOTAL PRESUPUESTO...")
    const totalPresMatch = b.match(/TOTAL PRESUPUESTO\s*\$\s*([\d.,]+)/i);
    if (totalPresMatch) totalPresupuesto = parseTotal(totalPresMatch[1]);
    const depMatch = a.match(/DEPOSITO[^$]*\$\s*([\d.,]+)/i);
    if (depMatch) depositoInicial = parseTotal(depMatch[1]);
  }

  return {
    repuestos,
    manoDeObra,
    totalRepuestos: totalRepuestos ?? repuestos.reduce((s, r) => s + r.valorTotal, 0),
    totalManoDeObra: totalManoDeObra ?? manoDeObra.reduce((s, m) => s + m.valorTotal, 0),
    totalPresupuesto: totalPresupuesto ?? (totalRepuestos ?? 0) + (totalManoDeObra ?? 0),
    depositoInicial,
  };
}

function parseTotal(str) {
  const n = String(str).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  return parseInt(n, 10) || 0;
}

module.exports = { parsePresupuestoExcel };
