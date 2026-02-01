const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const FONT_SIZE = 10;
const FONT_SIZE_TITLE = 14;
const FONT_SIZE_SECTION = 11;
const ROW_HEIGHT = 18;
const LINE_HEIGHT = 14;
const BORDER = 0.5;
const BORDER_THICK = 1;
const COL_VALOR_WIDTH = 95;
const COL_DESC_WIDTH = CONTENT_WIDTH - COL_VALOR_WIDTH;
const LOGO_HEIGHT = 52;
const LOGO_WIDTH = 52;
const CONTACTO_WIDTH = 185;
const CONTACTO_PAD = 8;
const black = rgb(0, 0, 0);

function formatMoneda(valor) {
  return '$ ' + Number(valor).toLocaleString('es-CL');
}
function drawRect(page, x, y, w, h, thickness = BORDER) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: black, borderWidth: thickness });
}
function drawLine(page, x1, y1, x2, y2, thickness = BORDER) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: black });
}
function truncateToWidth(text, maxChars) {
  const safe = String(text);
  return safe.length <= maxChars ? safe : safe.slice(0, maxChars - 3) + '...';
}

async function generatePresupuestoPdf(data, logoBuffer) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { height } = page.getSize();

  let logoBytes = logoBuffer && Buffer.isBuffer(logoBuffer) ? logoBuffer : null;
  if (!logoBytes && logoBuffer && typeof logoBuffer.length === 'number') {
    try { logoBytes = Buffer.from(logoBuffer); } catch (_) {}
  }
  if (!logoBytes) {
    const logoPath = path.join(__dirname, '..', 'logo.png');
    if (fs.existsSync(logoPath)) logoBytes = fs.readFileSync(logoPath);
  }
  if (logoBytes && logoBytes.length > 0) {
    try {
      const logoImage = await doc.embedPng(logoBytes);
      const scale = LOGO_HEIGHT / logoImage.height;
      page.drawImage(logoImage, {
        x: MARGIN,
        y: height - MARGIN - LOGO_HEIGHT,
        width: logoImage.width * scale,
        height: LOGO_HEIGHT,
      });
    } catch (_) {}
  }

  const titleX = MARGIN + LOGO_WIDTH + 14;
  let y = height - MARGIN - 6;
  page.drawText('Orden de Trabajo GPARTS', { x: titleX, y, size: FONT_SIZE_TITLE, font: fontBold, color: black });
  y -= LINE_HEIGHT;
  page.drawText('0000001855', { x: titleX, y, size: FONT_SIZE, font: fontBold, color: black });

  const contactoHeight = 7 * LINE_HEIGHT + CONTACTO_PAD * 2;
  const contactoX = PAGE_WIDTH - MARGIN - CONTACTO_WIDTH;
  const contactoY = height - MARGIN - contactoHeight;
  drawRect(page, contactoX, contactoY, CONTACTO_WIDTH, contactoHeight);
  const contactLines = ['joaquin Miranda', 'jmiranda@gparts.cl', 'Av. Pedro de Valdivia 5198, Ñuñoa.', 'Santiago, Chile', '+56 9 8136 7788', 'www.gparts.cl', 'COPIA CLIENTE'];
  let yContacto = height - MARGIN - CONTACTO_PAD - 12;
  contactLines.forEach((line) => {
    page.drawText(line, { x: contactoX + CONTACTO_PAD, y: yContacto, size: FONT_SIZE, font: line === 'COPIA CLIENTE' ? fontBold : font, color: black });
    yContacto -= LINE_HEIGHT;
  });

  y = contactoY - 12;
  drawLine(page, MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y -= LINE_HEIGHT + 4;

  const clienteBoxHeight = LINE_HEIGHT + 8 + 3 * LINE_HEIGHT + 10;
  drawRect(page, MARGIN, y - clienteBoxHeight, CONTENT_WIDTH, clienteBoxHeight);
  page.drawText('Datos del Cliente', { x: MARGIN + 6, y: y - 14, size: FONT_SIZE_SECTION, font: fontBold, color: black });
  y -= LINE_HEIGHT + 12;
  const c = data.cliente || {};
  const clienteLeft = [{ label: 'Nombre', value: c.nombre || '' }, { label: 'Rut', value: c.rut || '' }, { label: 'Dirección', value: c.direccion || '' }];
  const clienteRight = [{ label: 'Fecha', value: c.fecha || '' }, { label: 'Fono', value: c.fono || '' }, { label: 'Email', value: c.email || '' }];
  const col2X = MARGIN + CONTENT_WIDTH * 0.5;
  for (let i = 0; i < 3; i++) {
    page.drawText(clienteLeft[i].label, { x: MARGIN + 6, y, size: FONT_SIZE, font: fontBold, color: black });
    page.drawText(clienteLeft[i].value, { x: MARGIN + 82, y, size: FONT_SIZE, font, color: black });
    page.drawText(clienteRight[i].label, { x: col2X + 6, y, size: FONT_SIZE, font: fontBold, color: black });
    page.drawText(clienteRight[i].value, { x: col2X + 52, y, size: FONT_SIZE, font, color: black });
    y -= LINE_HEIGHT;
  }
  y -= 14;

  const vehiculoBoxHeight = LINE_HEIGHT + 8 + 4 * LINE_HEIGHT + 10;
  drawRect(page, MARGIN, y - vehiculoBoxHeight, CONTENT_WIDTH, vehiculoBoxHeight);
  page.drawText('Datos del Vehículo', { x: MARGIN + 6, y: y - 14, size: FONT_SIZE_SECTION, font: fontBold, color: black });
  y -= LINE_HEIGHT + 12;
  const v = data.vehiculo || {};
  const vehiculoLeft = [{ label: 'Patente', value: v.patente || '' }, { label: 'Marca', value: v.marca || '' }, { label: 'Kilometraje', value: v.kilometraje || '' }, { label: 'Combustible', value: v.combustible || '' }];
  const vehiculoRight = [{ label: 'Año', value: v.ano || '' }, { label: 'Modelo', value: v.modelo || '' }, { label: 'VIN', value: v.vin || '' }, { label: 'Color', value: v.color || '' }];
  for (let i = 0; i < 4; i++) {
    page.drawText(vehiculoLeft[i].label, { x: MARGIN + 6, y, size: FONT_SIZE, font: fontBold, color: black });
    page.drawText(vehiculoLeft[i].value, { x: MARGIN + 82, y, size: FONT_SIZE, font, color: black });
    page.drawText(vehiculoRight[i].label, { x: col2X + 6, y, size: FONT_SIZE, font: fontBold, color: black });
    page.drawText(vehiculoRight[i].value, { x: col2X + 52, y, size: FONT_SIZE, font, color: black });
    y -= LINE_HEIGHT;
  }
  y -= 14;

  drawRect(page, MARGIN, y - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - ROW_HEIGHT);
  page.drawText('Descripción', { x: MARGIN + 6, y: y - 13, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText('Valor Total', { x: MARGIN + COL_DESC_WIDTH + 6, y: y - 13, size: FONT_SIZE, font: fontBold, color: black });
  y -= ROW_HEIGHT + 6;

  page.drawText('Repuestos', { x: MARGIN, y, size: FONT_SIZE_SECTION, font: fontBold, color: black });
  y -= ROW_HEIGHT;
  for (const item of data.repuestos) {
    page.drawText(truncateToWidth(item.descripcion, 50), { x: MARGIN, y, size: FONT_SIZE, font, color: black });
    page.drawText(formatMoneda(item.valorTotal), { x: MARGIN + COL_DESC_WIDTH, y, size: FONT_SIZE, font, color: black });
    y -= ROW_HEIGHT;
  }
  y -= 4;
  page.drawText('Mano de Obra', { x: MARGIN, y, size: FONT_SIZE_SECTION, font: fontBold, color: black });
  y -= ROW_HEIGHT;
  for (const item of data.manoDeObra) {
    page.drawText(truncateToWidth(item.descripcion, 50), { x: MARGIN, y, size: FONT_SIZE, font, color: black });
    page.drawText(formatMoneda(item.valorTotal), { x: MARGIN + COL_DESC_WIDTH, y, size: FONT_SIZE, font, color: black });
    y -= ROW_HEIGHT;
  }
  y -= 6;
  drawLine(page, MARGIN, y, MARGIN + CONTENT_WIDTH, y);
  y -= ROW_HEIGHT;
  drawRect(page, MARGIN, y - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT, BORDER_THICK);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - ROW_HEIGHT, BORDER_THICK);
  page.drawText('Total', { x: MARGIN + 6, y: y - 13, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(formatMoneda(data.totalPresupuesto), { x: MARGIN + COL_DESC_WIDTH + 6, y: y - 13, size: FONT_SIZE, font: fontBold, color: black });

  return doc.save();
}

module.exports = { generatePresupuestoPdf };
