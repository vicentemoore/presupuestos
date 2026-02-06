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

// Logo (altura fija, más grande; poco espacio arriba)
const LOGO_TOP_MARGIN = 3;
const LOGO_HEIGHT = 170;
const LOGO_WIDTH = 170;

// Bloque contacto (derecha); algo más ancho al reducir margen
const CONTACTO_WIDTH = 200;
const CONTACTO_PAD = 8;

const black = rgb(0, 0, 0);

const FOOTER_TEXT = '*LA VALIDEZ DE LA COTIZACIÓN ES DE 7 DÍAS*';
const FOOTER_FONT_SIZE = 9;
const FOOTER_Y = 16;

const BANK_SECTION_TITLE = 'CUENTA PARA DEPÓSITOS DE REPUESTOS:';
const BANK_LINES = [
  'LUZ SOTO',
  '12.274.838-3',
  'BANCO DE CHILE',
  'CUENTA VISTA 00-023-25250-80',
  'JOAQUINMIRAND22@HOTMAIL.COM',
];
const BANK_FONT_SIZE_TITLE = 9;
const BANK_FONT_SIZE_LINE = 9;
const BANK_LINE_HEIGHT = 11;
const BANK_BOTTOM_PAD = 30; // separación sobre el footer de 7 días

const ORDEN_PREFIX = 'PRESUPUESTOS_ORDEN_V1:';

function safeOrdenForEmbed(orden) {
  // No embebemos cosas pesadas o innecesarias (por ejemplo, logos en base64).
  if (!orden || typeof orden !== 'object') return null;
  const cloned = JSON.parse(JSON.stringify(orden));
  if (cloned.logo) delete cloned.logo;
  return cloned;
}

function embedOrdenInMetadata(doc, orden) {
  const safe = safeOrdenForEmbed(orden);
  if (!safe) return;
  try {
    const json = JSON.stringify(safe);
    const b64 = Buffer.from(json, 'utf8').toString('base64');
    const payload = ORDEN_PREFIX + b64;
    if (typeof doc.setSubject === 'function') doc.setSubject(payload);
    if (typeof doc.setKeywords === 'function') doc.setKeywords([payload]);
    if (typeof doc.setTitle === 'function') doc.setTitle(payload);
  } catch (_) {}
}

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

function isFilled(val) {
  return String(val || '').trim() !== '';
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

  // Dibujar centrado, por encima del footer de 7 días
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

async function generatePresupuestoPdf(data, logoBuffer, orden) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { height } = page.getSize();

  // --- Logo: usar buffer enviado desde la web; si no, intentar archivo local ---
  let logoBytes = logoBuffer && Buffer.isBuffer(logoBuffer) ? logoBuffer : null;
  if (!logoBytes && typeof logoBuffer === 'object' && logoBuffer !== null && logoBuffer.length > 0) {
    logoBytes = Buffer.from(logoBuffer);
  }
  if (!logoBytes) {
    const logoPathPdf = path.join(__dirname, 'logo-pdf.jpeg');
    const logoPathJpeg = path.join(__dirname, 'logo.jpeg');
    const logoPathPng = path.join(__dirname, 'logo.png');
    if (fs.existsSync(logoPathPdf)) logoBytes = fs.readFileSync(logoPathPdf);
    else if (fs.existsSync(logoPathJpeg)) logoBytes = fs.readFileSync(logoPathJpeg);
    else if (fs.existsSync(logoPathPng)) logoBytes = fs.readFileSync(logoPathPng);
  }
  if (logoBytes && logoBytes.length > 0) {
    try {
      const isJpeg = logoBytes[0] === 0xff && logoBytes[1] === 0xd8;
      const logoImage = isJpeg ? await doc.embedJpg(logoBytes) : await doc.embedPng(logoBytes);
      const scale = LOGO_HEIGHT / logoImage.height;
      page.drawImage(logoImage, {
        x: MARGIN,
        y: height - LOGO_TOP_MARGIN - LOGO_HEIGHT,
        width: logoImage.width * scale,
        height: LOGO_HEIGHT,
      });
    } catch (_) {}
  }

  // --- Presupuesto N° debajo del logo, fuente un poco más pequeña ---
  let y = height - LOGO_TOP_MARGIN - LOGO_HEIGHT;
  const presupuestoNumero = String(data.presupuestoNumero || '').trim();
  const presupuestoLine = presupuestoNumero ? 'Presupuesto N° ' + presupuestoNumero : 'Presupuesto N°';
  page.drawText(presupuestoLine, {
    x: MARGIN,
    y,
    size: FONT_SIZE_PRESUPUESTO,
    font: fontBold,
    color: black,
  });
  // no usar este y para layout de secciones; recalculamos luego según recuadros

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
  const headerBottomY = height - LOGO_TOP_MARGIN - LOGO_HEIGHT; // borde inferior del logo / línea de presupuesto
  const presupuestoGap = 8; // menos aire hacia abajo
  const contactoGap = 8; // menos aire hacia abajo
  const presupuestoBottomY = headerBottomY - presupuestoGap;
  y = Math.min(contactoY - contactoGap, presupuestoBottomY);

  // --- Recuadro Datos del Cliente (valores con algo más de margen respecto a labels) ---
  const labelWidth = 52;
  const clienteValueGap = 14;
  const clienteValueX = MARGIN + 6 + labelWidth + clienteValueGap;
  const col2X = MARGIN + CONTENT_WIDTH * 0.5;
  const col2ValueX = col2X + 46;
  const clienteBoxHeight = LINE_HEIGHT + 8 + 6 + 2 * LINE_HEIGHT + 10; // título + espacio + 2 filas (Nombre, Rut)
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
  page.drawText('Nombre', { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.nombre || '', { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  page.drawText('Fecha', { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.fecha || '', { x: col2ValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  y -= LINE_HEIGHT;
  page.drawText('Rut', { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.rut || '', { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  page.drawText('Fono', { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
  page.drawText(c.fono || '', { x: col2ValueX, y, size: FONT_SIZE_DATOS, font, color: black });
  y -= 38;

  // --- Recuadro Datos del Vehículo (más espacio respecto a Cliente) ---
  const v = data.vehiculo || {};
  const vehiculoRows = [
    { left: { label: 'Patente', value: v.patente }, right: { label: 'Año', value: v.ano } },
    { left: { label: 'Marca', value: v.marca }, right: { label: 'Modelo', value: v.modelo } },
    { left: { label: 'Kilometraje', value: formatKilometraje(v.kilometraje) }, right: { label: 'VIN', value: v.vin } },
    { left: { label: 'Combustible', value: v.combustible }, right: { label: 'Color', value: v.color } },
  ].filter((row) => {
    const hasLeft = row.left && isFilled(row.left.value);
    const hasRight = row.right && isFilled(row.right.value);
    return hasLeft || hasRight;
  });
  const vehiculoBoxHeight = (LINE_HEIGHT + 18) + (vehiculoRows.length * LINE_HEIGHT) + 6;
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
  for (const row of vehiculoRows) {
    const leftHas = row.left && isFilled(row.left.value);
    const rightHas = row.right && isFilled(row.right.value);

    if (leftHas) {
      page.drawText(row.left.label, { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
      page.drawText(String(row.left.value), { x: MARGIN + 82, y, size: FONT_SIZE_DATOS, font, color: black });
    }

    if (rightHas) {
      if (leftHas) {
        page.drawText(row.right.label, { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
        page.drawText(String(row.right.value), { x: col2X + 52, y, size: FONT_SIZE_DATOS, font, color: black });
      } else {
        page.drawText(row.right.label, { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
        page.drawText(String(row.right.value), { x: MARGIN + 82, y, size: FONT_SIZE_DATOS, font, color: black });
      }
    }

    y -= LINE_HEIGHT;
  }
  // Evitar acumular desfases: anclar al borde inferior real del recuadro
  y = vehiculoBoxY - 14;

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
    const valorMostrar = typeof item.valorMostrar === 'number' ? item.valorMostrar : item.valorTotal;
    page.drawText(formatMoneda(valorMostrar), {
      x: MARGIN + COL_DESC_WIDTH + 6,
      y: firstLineY,
      size: FONT_SIZE,
      font,
      color: black,
    });
    y -= Math.max(0, ROW_HEIGHT - descLines.length * LINE_HEIGHT);
  }
  // Barra de "Depósito inicial de trabajos" (total repuestos) antes de Mano de Obra
  // Menos aire arriba, más aire abajo (para que no quede pegado con "Mano de Obra")
  y -= 2;
  drawRect(page, MARGIN, y - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT, BORDER_THICK);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - ROW_HEIGHT, BORDER_THICK);
  page.drawText('Depósito inicial de trabajos', {
    x: MARGIN + 6,
    y: y - 13,
    size: FONT_SIZE,
    font: fontBold,
    color: black,
  });
  page.drawText(formatMoneda(Number(data.totalRepuestos) || 0), {
    x: MARGIN + COL_DESC_WIDTH + 6,
    y: y - 13,
    size: FONT_SIZE,
    font: fontBold,
    color: black,
  });
  y -= ROW_HEIGHT + 18;

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
  // Un poco más de aire antes del resumen (Subtotal/Descuentos/Abono/A pagar/Total)
  y -= 14;

  // Resumen: Subtotal/Descuentos/Abono (si aplican) y siempre "Saldo a pagar" = total - abono
  const subtotal = typeof data.subtotalPresupuesto === 'number' ? data.subtotalPresupuesto : Number(data.totalPresupuesto) || 0;
  const descuentos = Array.isArray(data.descuentos) ? data.descuentos : [];
  const hasDescuentos = descuentos.length > 0;
  const abonoMonto = Math.max(0, parseInt(data.abonoMonto, 10) || 0);
  const totalOrden = Number(data.totalPresupuesto) || 0;
  const saldoAPagar = Math.max(0, totalOrden - abonoMonto);
  const summaryRows = [];
  if (hasDescuentos || abonoMonto > 0) {
    if (hasDescuentos) {
      summaryRows.push({ label: 'Subtotal', value: formatMoneda(subtotal), fontLeft: fontBold, fontRight: font });
      descuentos.forEach((d) => {
        const motivo = String((d && d.motivo) || '').trim();
        const label = motivo ? 'Descuento (' + motivo + ')' : 'Descuento';
        const monto = Math.max(0, parseInt(d && d.monto, 10) || 0);
        summaryRows.push({ label, value: formatMoneda(monto), fontLeft: fontBold, fontRight: font });
      });
    }
    if (abonoMonto > 0) summaryRows.push({ label: 'Abono', value: formatMoneda(abonoMonto), fontLeft: fontBold, fontRight: font });
  }
  summaryRows.push({ label: 'Saldo a pagar', value: formatMoneda(saldoAPagar), fontLeft: fontBold, fontRight: fontBold, thick: true });

  const summaryHeight = summaryRows.length * ROW_HEIGHT;
  drawRect(page, MARGIN, y - summaryHeight, CONTENT_WIDTH, summaryHeight, BORDER_THICK);
  drawLine(page, MARGIN + COL_DESC_WIDTH, y, MARGIN + COL_DESC_WIDTH, y - summaryHeight, BORDER_THICK);
  for (let i = 1; i < summaryRows.length; i++) {
    drawLine(page, MARGIN, y - i * ROW_HEIGHT, MARGIN + CONTENT_WIDTH, y - i * ROW_HEIGHT, BORDER);
  }
  for (let i = 0; i < summaryRows.length; i++) {
    const row = summaryRows[i];
    const rowTopY = y - i * ROW_HEIGHT;
    const textY = rowTopY - 13;
    page.drawText(row.label, {
      x: MARGIN + 6,
      y: textY,
      size: FONT_SIZE,
      font: row.fontLeft || fontBold,
      color: black,
    });
    page.drawText(row.value, {
      x: MARGIN + COL_DESC_WIDTH + 6,
      y: textY,
      size: FONT_SIZE,
      font: row.fontRight || fontBold,
      color: black,
    });
  }

  y -= summaryHeight + 20;
  const nota = String(data.nota || '').trim();
  if (nota) {
    const labelNota = 'Nota: ';
    const labelNotaWidth = fontBold.widthOfTextAtSize(labelNota, FONT_SIZE);
    const notaLines = wrapTextByWidth(nota, font, FONT_SIZE, CONTENT_WIDTH - 12 - labelNotaWidth);
    page.drawText(labelNota, {
      x: MARGIN + 6,
      y,
      size: FONT_SIZE,
      font: fontBold,
      color: black,
    });
    if (notaLines.length > 0) {
      page.drawText(notaLines[0], {
        x: MARGIN + 6 + labelNotaWidth,
        y,
        size: FONT_SIZE,
        font,
        color: black,
      });
      y -= LINE_HEIGHT;
      for (let i = 1; i < notaLines.length; i++) {
        page.drawText(notaLines[i], {
          x: MARGIN + 6,
          y,
          size: FONT_SIZE,
          font,
          color: black,
        });
        y -= LINE_HEIGHT;
      }
    } else {
      y -= LINE_HEIGHT;
    }
  }

  embedOrdenInMetadata(doc, orden);
  drawBankInfoOnFirstPage(doc, fontBold, font);
  drawFooterOnAllPages(doc, fontItalic);
  const pdfBytes = await doc.save();
  return pdfBytes;
}

module.exports = { generatePresupuestoPdf };
