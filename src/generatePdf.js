const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const FONT_SIZE = 10;
const FONT_SIZE_HEADER = 12;
const FONT_SIZE_SECTION = 11;
const ROW_HEIGHT = 18;
const LINE_HEIGHT = 14;

const COL_VALOR_WIDTH = 95;
const COL_DESC_WIDTH = CONTENT_WIDTH - COL_VALOR_WIDTH;
const CONTACTO_X = PAGE_WIDTH - MARGIN - 180;

function formatMoneda(valor) {
  return '$ ' + Number(valor).toLocaleString('es-CL');
}

function drawLine(page, y, font, fromX = MARGIN, toX = PAGE_WIDTH - MARGIN) {
  page.drawLine({
    start: { x: fromX, y },
    end: { x: toX, y },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
}

async function generatePresupuestoPdf(data) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { height } = page.getSize();

  let y = height - MARGIN;

  page.drawText('Orden de Trabajo GPARTS', {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT;
  page.drawText('0000001855', {
    x: MARGIN,
    y,
    size: FONT_SIZE,
    font,
    color: rgb(0, 0, 0),
  });

  let yRight = height - MARGIN;
  const contactLines = [
    'joaquin Miranda',
    'jmiranda@gparts.cl',
    'Av. Pedro de Valdivia 5198, Ñuñoa.',
    'Santiago, Chile',
    '+56 9 8136 7788',
    'www.gparts.cl',
    'COPIA CLIENTE',
  ];
  contactLines.forEach((line) => {
    page.drawText(line, {
      x: CONTACTO_X,
      y: yRight,
      size: FONT_SIZE,
      font: line === 'COPIA CLIENTE' ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    yRight -= LINE_HEIGHT;
  });

  y -= LINE_HEIGHT * 2;
  drawLine(page, y, font);
  y -= LINE_HEIGHT;

  page.drawText('Datos del Cliente', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT + 4;

  const clienteLeft = [
    { label: 'Nombre', value: 'LICORES.CL SPA' },
    { label: 'Rut', value: '76563323-0' },
    { label: 'Dirección', value: 'SALOMON SUMAR 3420, J-1. San Joaquín' },
  ];
  const clienteRight = [
    { label: 'Fecha', value: '17/03/2023' },
    { label: 'Fono', value: '+56 9 8259-6903' },
    { label: 'Email', value: 'xxxx@xxx' },
  ];
  const col2X = MARGIN + CONTENT_WIDTH * 0.5;
  for (let i = 0; i < 3; i++) {
    page.drawText(clienteLeft[i].label, { x: MARGIN, y, size: FONT_SIZE, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(clienteLeft[i].value, { x: MARGIN + 75, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    page.drawText(clienteRight[i].label, { x: col2X, y, size: FONT_SIZE, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(clienteRight[i].value, { x: col2X + 45, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    y -= LINE_HEIGHT;
  }
  y -= 6;
  drawLine(page, y, font);
  y -= LINE_HEIGHT;

  page.drawText('Datos del Vehículo', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT + 4;

  const vehiculoLeft = [
    { label: 'Patente', value: 'JDZC-59' },
    { label: 'Marca', value: 'HYUNDAI' },
    { label: 'Kilometraje', value: '120.563' },
    { label: 'Combustible', value: 'Diesel' },
  ];
  const vehiculoRight = [
    { label: 'Año', value: '2017' },
    { label: 'Modelo', value: 'H1 Fg Crdi Gl 2.5' },
    { label: 'VIN', value: 'KMFWBX7KAGU806376' },
    { label: 'Color', value: 'BLANCO' },
  ];
  for (let i = 0; i < 4; i++) {
    page.drawText(vehiculoLeft[i].label, { x: MARGIN, y, size: FONT_SIZE, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(vehiculoLeft[i].value, { x: MARGIN + 75, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    page.drawText(vehiculoRight[i].label, { x: col2X, y, size: FONT_SIZE, font: fontBold, color: rgb(0, 0, 0) });
    page.drawText(vehiculoRight[i].value, { x: col2X + 45, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    y -= LINE_HEIGHT;
  }
  y -= 6;
  drawLine(page, y, font);
  y -= LINE_HEIGHT + 4;

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
  drawLine(page, y, font, MARGIN, MARGIN + CONTENT_WIDTH);
  y -= 8;

  page.drawText('Repuestos', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= ROW_HEIGHT;

  for (const item of data.repuestos) {
    const desc = truncateToWidth(item.descripcion, 50);
    page.drawText(desc, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    page.drawText(formatMoneda(item.valorTotal), { x: MARGIN + COL_DESC_WIDTH, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    y -= ROW_HEIGHT;
  }
  y -= 4;

  page.drawText('Mano de Obra', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= ROW_HEIGHT;

  for (const item of data.manoDeObra) {
    const desc = truncateToWidth(item.descripcion, 50);
    page.drawText(desc, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    page.drawText(formatMoneda(item.valorTotal), { x: MARGIN + COL_DESC_WIDTH, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
    y -= ROW_HEIGHT;
  }
  y -= 8;

  drawLine(page, y, font, MARGIN, MARGIN + CONTENT_WIDTH);
  y -= ROW_HEIGHT;
  page.drawText('Total', { x: MARGIN, y, size: FONT_SIZE, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(formatMoneda(data.totalPresupuesto), { x: MARGIN + COL_DESC_WIDTH, y, size: FONT_SIZE, font: fontBold, color: rgb(0, 0, 0) });
  y -= ROW_HEIGHT * 2;

  page.drawText('Trabajo a realizar', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT + 8;
  drawLine(page, y, font);

  const pdfBytes = await doc.save();
  return pdfBytes;
}

function truncateToWidth(text, maxChars) {
  const safe = String(text);
  if (safe.length <= maxChars) return safe;
  return safe.slice(0, maxChars - 3) + '...';
}

module.exports = { generatePresupuestoPdf };
