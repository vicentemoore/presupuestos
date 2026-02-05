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
const LOGO_HEIGHT = 104;
const LOGO_WIDTH = 104;
const CONTACTO_WIDTH = 185;
const CONTACTO_PAD = 8;
const black = rgb(0, 0, 0);

const FOOTER_TEXT = '*la validez de la cotización es de 7 días*';
const FOOTER_FONT_SIZE = 9;
const FOOTER_Y = 16;

const BANK_SECTION_TITLE = 'Cuenta para depósitos de repuestos:';
const BANK_LINES = [
  'Luz Soto',
  '12.274.838-3',
  'Banco de Chile',
  'Cuenta Vista 00-023-25250-80',
  'Joaquinmirand22@hotmail.com',
];
const BANK_FONT_SIZE_TITLE = 9;
const BANK_FONT_SIZE_LINE = 9;
const BANK_LINE_HEIGHT = 11;
const BANK_BOTTOM_PAD = 30;

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

function drawFooterOnAllPages(doc, font) {
  const pages = doc.getPages();
  for (const page of pages) {
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(FOOTER_TEXT, FOOTER_FONT_SIZE);
    const x = Math.max(0, (width - textWidth) / 2);
    page.drawText(FOOTER_TEXT, {
      x,
      y: FOOTER_Y,
      size: FOOTER_FONT_SIZE,
      font,
      color: black,
    });
  }
}

function drawBankInfoOnFirstPage(doc, fontBold, font) {
  const pages = doc.getPages();
  if (!pages || pages.length === 0) return;
  const page = pages[0];
  const { width } = page.getSize();

  let y = FOOTER_Y + BANK_BOTTOM_PAD + (BANK_LINES.length * BANK_LINE_HEIGHT) + 2;

  const titleWidth = fontBold.widthOfTextAtSize(BANK_SECTION_TITLE, BANK_FONT_SIZE_TITLE);
  page.drawText(BANK_SECTION_TITLE, {
    x: Math.max(0, (width - titleWidth) / 2),
    y,
    size: BANK_FONT_SIZE_TITLE,
    font: fontBold,
    color: black,
  });
  y -= BANK_LINE_HEIGHT;

  for (const line of BANK_LINES) {
    const w = font.widthOfTextAtSize(line, BANK_FONT_SIZE_LINE);
    page.drawText(line, {
      x: Math.max(0, (width - w) / 2),
      y,
      size: BANK_FONT_SIZE_LINE,
      font,
      color: black,
    });
    y -= BANK_LINE_HEIGHT;
  }
}

async function generatePresupuestoPdf(data, logoBuffer) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
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
  const presupuestoNumero = String((data && data.presupuestoNumero) || '').trim();
  const presupuestoLine = presupuestoNumero ? 'Presupuesto N° ' + presupuestoNumero : 'Presupuesto N°';
  page.drawText(presupuestoLine, { x: titleX, y, size: FONT_SIZE_TITLE, font: fontBold, color: black });
  y -= LINE_HEIGHT;

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

  // Reducir aire hacia abajo: empezar contenido más arriba
  y = contactoY - 8;
  y -= 6;
  const labelWidth = 52;
  const clienteValueX = MARGIN + 6 + labelWidth;
  const col2X = MARGIN + CONTENT_WIDTH * 0.5;
  const clienteBoxHeight = LINE_HEIGHT + 8 + 4 * LINE_HEIGHT + 10;
  drawRect(page, MARGIN, y - clienteBoxHeight, CONTENT_WIDTH, clienteBoxHeight);
  page.drawText('Datos del Cliente', { x: MARGIN + 6, y: y - 14, size: FONT_SIZE_SECTION, font: fontBold, color: black });
  y -= LINE_HEIGHT + 12;
  const c = (data && data.cliente) || {};
  page.drawText('Nombre', { x: MARGIN + 6, y, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(c.nombre || '', { x: clienteValueX, y, size: FONT_SIZE, font, color: black });
  page.drawText('Fecha', { x: col2X + 6, y, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(c.fecha || '', { x: col2X + 38, y, size: FONT_SIZE, font, color: black });
  y -= LINE_HEIGHT;
  page.drawText('Rut', { x: MARGIN + 6, y, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(c.rut || '', { x: clienteValueX, y, size: FONT_SIZE, font, color: black });
  page.drawText('Fono', { x: col2X + 6, y, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(c.fono || '', { x: col2X + 38, y, size: FONT_SIZE, font, color: black });
  y -= LINE_HEIGHT;
  // Dirección eliminada (ya no se utiliza)
  page.drawText('Email', { x: MARGIN + 6, y, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(c.email || '', { x: clienteValueX, y, size: FONT_SIZE, font, color: black });
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
  y -= ROW_HEIGHT + 14;

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
  drawRect(page, MARGIN, y - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT, BORDER_THICK);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - ROW_HEIGHT, BORDER_THICK);
  page.drawText('Total', { x: MARGIN + 6, y: y - 13, size: FONT_SIZE, font: fontBold, color: black });
  page.drawText(formatMoneda(data.totalPresupuesto), { x: MARGIN + COL_DESC_WIDTH + 6, y: y - 13, size: FONT_SIZE, font: fontBold, color: black });

  drawBankInfoOnFirstPage(doc, fontBold, font);
  drawFooterOnAllPages(doc, fontItalic);
  return doc.save();
}

module.exports = { generatePresupuestoPdf };
