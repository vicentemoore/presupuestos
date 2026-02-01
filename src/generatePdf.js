const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const ROW_HEIGHT = 20;
const FONT_SIZE = 10;
const FONT_SIZE_HEADER = 12;
const FONT_SIZE_SECTION = 11;

// Columnas de la tabla: Descripción (ancho variable) | Valor Total (fijo)
const COL_VALOR_WIDTH = 90;
const COL_DESC_WIDTH = CONTENT_WIDTH - COL_VALOR_WIDTH;

function formatMoneda(valor) {
  return '$ ' + Number(valor).toLocaleString('es-CL');
}

/**
 * Genera un PDF con el formato del presupuesto: tabla Repuestos y Mano de Obra.
 * @param {Object} data - { repuestos, manoDeObra, totalRepuestos, totalManoDeObra, totalPresupuesto }
 * @returns {Promise<Uint8Array>} PDF en bytes
 */
async function generatePresupuestoPdf(data) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { width, height } = page.getSize();

  let y = height - MARGIN;

  // --- Encabezado ---
  page.drawText('Orden de Trabajo GPARTS', {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 22;

  page.drawText('COPIA CLIENTE', {
    x: MARGIN,
    y,
    size: FONT_SIZE_HEADER,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 28;

  // --- Tabla: encabezado "Descripción" | "Valor Total" ---
  const tableTop = y;
  page.drawText('Descripción', {
    x: MARGIN,
    y,
    size: FONT_SIZE,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText('Valor Total', {
    x: MARGIN + COL_DESC_WIDTH,
    y,
    size: FONT_SIZE,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= ROW_HEIGHT;

  // Línea bajo encabezado
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  y -= 8;

  // --- Repuestos ---
  page.drawText('Repuestos', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= ROW_HEIGHT;

  for (const item of data.repuestos) {
    const desc = truncateToWidth(item.descripcion, COL_DESC_WIDTH - 10, font, FONT_SIZE);
    page.drawText(desc, {
      x: MARGIN,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(formatMoneda(item.valorTotal), {
      x: MARGIN + COL_DESC_WIDTH,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    y -= ROW_HEIGHT;
  }
  y -= 4;

  // --- Mano de Obra ---
  page.drawText('Mano de Obra', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= ROW_HEIGHT;

  for (const item of data.manoDeObra) {
    const desc = truncateToWidth(item.descripcion, COL_DESC_WIDTH - 10, font, FONT_SIZE);
    page.drawText(desc, {
      x: MARGIN,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(formatMoneda(item.valorTotal), {
      x: MARGIN + COL_DESC_WIDTH,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    y -= ROW_HEIGHT;
  }
  y -= 12;

  // --- Total ---
  page.drawText('Total', {
    x: MARGIN,
    y,
    size: FONT_SIZE,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText(formatMoneda(data.totalPresupuesto), {
    x: MARGIN + COL_DESC_WIDTH,
    y,
    size: FONT_SIZE,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 24;

  page.drawText('Trabajo a realizar', {
    x: MARGIN,
    y,
    size: FONT_SIZE,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}

/**
 * Trunca texto para que no exceda un ancho aproximado en puntos (simplificado).
 */
function truncateToWidth(text, maxWidth, font, size) {
  const safe = String(text);
  if (safe.length <= 45) return safe;
  return safe.slice(0, 42) + '...';
}

module.exports = { generatePresupuestoPdf };
