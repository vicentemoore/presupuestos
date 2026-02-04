const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MARGIN = 38;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const FONT_SIZE = 10;
const FONT_SIZE_TITLE = 14;
const FONT_SIZE_PRESUPUESTO = 11;
const FONT_SIZE_SECTION = 13;
const FONT_SIZE_DATOS = 11;
const ROW_HEIGHT = 18;
const LINE_HEIGHT = 14;
const BORDER = 0.5;
const BORDER_THICK = 1;

// Tabla (más ancho para descripción al tener más CONTENT_WIDTH)
const COL_VALOR_WIDTH = 100;
const COL_DESC_WIDTH = CONTENT_WIDTH - COL_VALOR_WIDTH;
const DESC_INDENT = 12; // margen izquierdo en celdas de descripción (Repuestos/Mano de Obra)
const DESC_MAX_WIDTH = COL_DESC_WIDTH - DESC_INDENT - 6; // ancho útil para texto antes de columna Valor

// Logo (altura fija, doble de tamaño)
const LOGO_HEIGHT = 104;
const LOGO_WIDTH = 104;

// Bloque contacto (derecha); algo más ancho al reducir margen
const CONTACTO_WIDTH = 200;
const CONTACTO_PAD = 8;

const black = rgb(0, 0, 0);

function formatMoneda(valor) {
  return '$ ' + Number(valor).toLocaleString('es-CL');
}

function formatKilometraje(val) {
  const s = String(val || '').trim();
  if (!s) return s;
  const n = parseInt(s.replace(/\D/g, ''), 10);
  if (isNaN(n)) return s;
  return n.toLocaleString('es-CL');
}

function drawRect(page, x, y, w, h, thickness = BORDER) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: black,
    borderWidth: thickness,
  });
}

function drawLine(page, x1, y1, x2, y2, thickness = BORDER) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: black,
  });
}

function truncateToWidth(text, maxChars) {
  const safe = String(text);
  if (safe.length <= maxChars) return safe;
  return safe.slice(0, maxChars - 3) + '...';
}

/**
 * Divide el texto en líneas que no superen maxWidth (en puntos).
 * Usa la fuente para medir; si una palabra se pasa, la parte en la línea siguiente.
 */
function wrapTextByWidth(text, font, fontSize, maxWidth) {
  const safe = String(text).trim();
  if (!safe) return [];
  const words = safe.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    const w = font.widthOfTextAtSize(candidate, fontSize);
    if (w <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        current = word;
      } else {
        let rest = word;
        while (rest) {
          let chunk = '';
          for (let i = 0; i < rest.length; i++) {
            if (font.widthOfTextAtSize(chunk + rest[i], fontSize) <= maxWidth) chunk += rest[i];
            else break;
          }
          if (chunk) {
            lines.push(chunk);
            rest = rest.slice(chunk.length);
          } else {
            chunk = rest[0];
            rest = rest.slice(1);
            lines.push(chunk);
          }
        }
        current = '';
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function generatePresupuestoPdf(data, logoBuffer) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { height } = page.getSize();

  // --- Logo: usar buffer enviado desde la web; si no, intentar archivo local ---
  let logoBytes = logoBuffer && Buffer.isBuffer(logoBuffer) ? logoBuffer : null;
  if (!logoBytes && typeof logoBuffer === 'object' && logoBuffer !== null && logoBuffer.length > 0) {
    logoBytes = Buffer.from(logoBuffer);
  }
  if (!logoBytes) {
    const logoPath = path.join(__dirname, 'logo.png');
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

  // --- Presupuesto N° debajo del logo, fuente un poco más pequeña ---
  let y = height - MARGIN - LOGO_HEIGHT - 18;
  const presupuestoNumero = String(data.presupuestoNumero || '').trim();
  const presupuestoLine = presupuestoNumero ? 'Presupuesto N° ' + presupuestoNumero : 'Presupuesto N°';
  page.drawText(presupuestoLine, {
    x: MARGIN,
    y,
    size: FONT_SIZE_PRESUPUESTO,
    font: fontBold,
    color: black,
  });
  y -= LINE_HEIGHT;

  // --- Recuadro contacto (derecha); altura según cantidad de líneas ---
  const contactLines = [
    'Joaquin Miranda',
    "joaquinmirand22@hotmail.com",
    'Sanchez Fontecilla 4655, Puente Alto',
    '+56 9 8136 7788',
    'COPIA CLIENTE',
  ];
  const contactoHeight = contactLines.length * LINE_HEIGHT + CONTACTO_PAD * 2;
  const contactoX = PAGE_WIDTH - MARGIN - CONTACTO_WIDTH;
  const contactoY = height - MARGIN - contactoHeight;
  drawRect(page, contactoX, contactoY, CONTACTO_WIDTH, contactoHeight);
  let yContacto = height - MARGIN - CONTACTO_PAD - 12;
  contactLines.forEach((line) => {
    const lineFont = line === 'COPIA CLIENTE' ? fontBold : font;
    const textWidth = lineFont.widthOfTextAtSize(line, FONT_SIZE);
    const xRight = contactoX + CONTACTO_WIDTH - CONTACTO_PAD - textWidth;
    page.drawText(line, {
      x: xRight,
      y: yContacto,
      size: FONT_SIZE,
      font: lineFont,
      color: black,
    });
    yContacto -= LINE_HEIGHT;
  });

  // Inicio del contenido: debajo del recuadro de contacto Y debajo de "Presupuesto N°" (evitar solapamiento si el recuadro es pequeño)
  const presupuestoBottomY = height - MARGIN - LOGO_HEIGHT - 18 - FONT_SIZE_PRESUPUESTO - 11;
  y = Math.min(contactoY - 12 - LINE_HEIGHT - 4, presupuestoBottomY);

  // --- Recuadro Datos del Cliente (valores con algo más de margen respecto a labels) ---
  const labelWidth = 52;
  const clienteValueGap = 14;
  const clienteValueX = MARGIN + 6 + labelWidth + clienteValueGap;
  const col2X = MARGIN + CONTENT_WIDTH * 0.5;
  const clienteBoxHeight = LINE_HEIGHT + 8 + 6 + 2 * LINE_HEIGHT + LINE_HEIGHT + 10; // título + espacio + 2 filas + Email
  const clienteBoxY = y - clienteBoxHeight;
  drawRect(page, MARGIN, clienteBoxY, CONTENT_WIDTH, clienteBoxHeight);
  page.drawText('Datos del Cliente', {
    x: MARGIN + 6,
    y: y - 14,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: black,
  });
  y -= LINE_HEIGHT + 18;
  const c = data.cliente || {};
  // Filas: Nombre/Fecha, Rut/Fono, Email (abajo)
  page.drawText('Nombre', { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.nombre || '', { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  const col2ValueX = col2X + 46;
  page.drawText('Fecha', { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.fecha || '', { x: col2ValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  y -= LINE_HEIGHT;
  page.drawText('Rut', { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.rut || '', { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  page.drawText('Fono', { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.fono || '', { x: col2ValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  y -= LINE_HEIGHT;
  page.drawText('Email', { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.email || '', { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  y -= 38;

  // --- Recuadro Datos del Vehículo (más espacio respecto a Cliente) ---
  const vehiculoBoxHeight = LINE_HEIGHT + 8 + 6 + 4 * LINE_HEIGHT + 10;
  const vehiculoBoxY = y - vehiculoBoxHeight;
  drawRect(page, MARGIN, vehiculoBoxY, CONTENT_WIDTH, vehiculoBoxHeight);
  page.drawText('Datos del Vehículo', {
    x: MARGIN + 6,
    y: y - 14,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: black,
  });
  y -= LINE_HEIGHT + 18;
  const v = data.vehiculo || {};
  const vehiculoLeft = [
    { label: 'Patente', value: v.patente || '' },
    { label: 'Marca', value: v.marca || '' },
    { label: 'Kilometraje', value: formatKilometraje(v.kilometraje) },
    { label: 'Combustible', value: v.combustible || '' },
  ];
  const vehiculoRight = [
    { label: 'Año', value: v.ano || '' },
    { label: 'Modelo', value: v.modelo || '' },
    { label: 'VIN', value: v.vin || '' },
    { label: 'Color', value: v.color || '' },
  ];
  for (let i = 0; i < 4; i++) {
    page.drawText(vehiculoLeft[i].label, { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
    page.drawText(vehiculoLeft[i].value, { x: MARGIN + 82, y, size: FONT_SIZE_DATOS, font, color: black });
    page.drawText(vehiculoRight[i].label, { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
    page.drawText(vehiculoRight[i].value, { x: col2X + 52, y, size: FONT_SIZE_DATOS, font, color: black });
    y -= LINE_HEIGHT;
  }
  y -= 14;

  // --- Tabla: encabezado (Descripción | Valor Total); espacio claro antes de Repuestos ---
  drawRect(page, MARGIN, y - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - ROW_HEIGHT);
  page.drawText('Descripción', {
    x: MARGIN + 6,
    y: y - 13,
    size: FONT_SIZE,
    font: fontBold,
    color: black,
  });
  page.drawText('Valor Total', {
    x: MARGIN + COL_DESC_WIDTH + 6,
    y: y - 13,
    size: FONT_SIZE,
    font: fontBold,
    color: black,
  });
  y -= ROW_HEIGHT + 14;

  // Repuestos (bien separado del encabezado; descripción con margen y wrap completo)
  page.drawText('Repuestos', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: black,
  });
  y -= ROW_HEIGHT;
  for (const item of data.repuestos) {
    const cantidad = Math.max(1, parseInt(item.cantidad, 10) || 1);
    const descBase = String(item.descripcion || '').trim();
    const descSuffix = cantidad > 1 ? ' (x' + cantidad + ')' : '';
    const fullDesc = descBase + descSuffix;
    const descLines = wrapTextByWidth(fullDesc, font, FONT_SIZE, DESC_MAX_WIDTH);
    const firstLineY = y;
    for (let i = 0; i < descLines.length; i++) {
      page.drawText(descLines[i], {
        x: MARGIN + DESC_INDENT,
        y: y,
        size: FONT_SIZE,
        font,
        color: black,
      });
      y -= LINE_HEIGHT;
    }
    page.drawText(formatMoneda(item.valorTotal), {
      x: MARGIN + COL_DESC_WIDTH + 6,
      y: firstLineY,
      size: FONT_SIZE,
      font,
      color: black,
    });
    y -= Math.max(0, ROW_HEIGHT - descLines.length * LINE_HEIGHT);
  }
  y -= 4;

  // Mano de Obra
  page.drawText('Mano de Obra', {
    x: MARGIN,
    y,
    size: FONT_SIZE_SECTION,
    font: fontBold,
    color: black,
  });
  y -= ROW_HEIGHT;
  for (const item of data.manoDeObra) {
    const cantidad = Math.max(1, parseInt(item.cantidad, 10) || 1);
    const descBase = String(item.descripcion || '').trim();
    const descSuffix = cantidad > 1 ? ' (x' + cantidad + ')' : '';
    const fullDesc = descBase + descSuffix;
    const descLines = wrapTextByWidth(fullDesc, font, FONT_SIZE, DESC_MAX_WIDTH);
    const firstLineY = y;
    for (let i = 0; i < descLines.length; i++) {
      page.drawText(descLines[i], {
        x: MARGIN + DESC_INDENT,
        y: y,
        size: FONT_SIZE,
        font,
        color: black,
      });
      y -= LINE_HEIGHT;
    }
    page.drawText(formatMoneda(item.valorTotal), {
      x: MARGIN + COL_DESC_WIDTH + 6,
      y: firstLineY,
      size: FONT_SIZE,
      font,
      color: black,
    });
    y -= Math.max(0, ROW_HEIGHT - descLines.length * LINE_HEIGHT);
  }
  y -= 6;

  // Fila Total con borde más grueso (sin línea suelta encima)
  drawRect(page, MARGIN, y - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT, BORDER_THICK);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - ROW_HEIGHT, BORDER_THICK);
  page.drawText('Total', {
    x: MARGIN + 6,
    y: y - 13,
    size: FONT_SIZE,
    font: fontBold,
    color: black,
  });
  page.drawText(formatMoneda(data.totalPresupuesto), {
    x: MARGIN + COL_DESC_WIDTH + 6,
    y: y - 13,
    size: FONT_SIZE,
    font: fontBold,
    color: black,
  });

  const pdfBytes = await doc.save();
  return pdfBytes;
}

module.exports = { generatePresupuestoPdf };
