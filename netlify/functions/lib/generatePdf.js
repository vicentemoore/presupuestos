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

function isFilled(val) {
  return String(val || '').trim() !== '';
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
  const col2ValueX = col2X + 46;
  const c = data.cliente || {};
  const clienteRows = [
    { left: { label: 'Nombre', value: c.nombre }, right: { label: 'Fecha', value: c.fecha } },
    { left: { label: 'Rut', value: c.rut }, right: { label: 'Fono', value: c.fono } },
    { left: { label: 'Dirección', value: c.direccion, truncateChars: 62 } },
  ].filter((row) => {
    const hasLeft = row.left && isFilled(row.left.value);
    const hasRight = row.right && isFilled(row.right.value);
    return hasLeft || hasRight;
  });
  const clienteBoxHeight = (LINE_HEIGHT + 18) + (clienteRows.length * LINE_HEIGHT) + 6;
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
  // Filas dinámicas: si un valor no existe, no se dibuja (ni etiqueta ni valor)
  for (const row of clienteRows) {
    const leftHas = row.left && isFilled(row.left.value);
    const rightHas = row.right && isFilled(row.right.value);

    if (leftHas) {
      page.drawText(row.left.label, { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
      const value = row.left.truncateChars ? truncateToWidth(row.left.value, row.left.truncateChars) : String(row.left.value);
      page.drawText(value, { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
    }

    if (rightHas) {
      if (leftHas) {
        page.drawText(row.right.label, { x: col2X + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
        page.drawText(String(row.right.value), { x: col2ValueX, y, size: FONT_SIZE_DATOS, font, color: black });
      } else {
        // Si solo existe la columna derecha, la movemos a la izquierda para evitar huecos
        page.drawText(row.right.label, { x: MARGIN + 6, y, size: FONT_SIZE_DATOS, font: fontBold, color: black });
        page.drawText(String(row.right.value), { x: clienteValueX, y, size: FONT_SIZE_DATOS, font, color: black });
      }
    }

    y -= LINE_HEIGHT;
  }
  // Separación dinámica: quedar justo bajo el recuadro (sin huecos grandes si faltan datos)
  y = clienteBoxY - 22;

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
    page.drawText(formatMoneda(item.valorTotal), {
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
  y -= 6;

  // Resumen (con descuento opcional)
  const subtotal = typeof data.subtotalPresupuesto === 'number' ? data.subtotalPresupuesto : Number(data.totalPresupuesto) || 0;
  const descuentoMonto = Number(data.descuentoMonto) || 0;
  const hasDescuento = descuentoMonto > 0;
  const summaryRows = hasDescuento
    ? [
        { label: 'Subtotal', value: formatMoneda(subtotal), fontLeft: fontBold, fontRight: font },
        { label: 'Descuento', value: '- ' + formatMoneda(descuentoMonto), fontLeft: fontBold, fontRight: font },
        { label: 'Total', value: formatMoneda(data.totalPresupuesto), fontLeft: fontBold, fontRight: fontBold, thick: true },
      ]
    : [
        { label: 'Total', value: formatMoneda(data.totalPresupuesto), fontLeft: fontBold, fontRight: fontBold, thick: true },
      ];

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

  const pdfBytes = await doc.save();
  return pdfBytes;
}

module.exports = { generatePresupuestoPdf };
