const { generatePresupuestoPdf } = require('./lib/generatePdf');

/**
 * Convierte el payload de la web (repuestos/manoDeObra con descripcion, cantidad, valor)
 * al formato que espera generatePdf (descripcion, valorTotal).
 * Valor se interpreta como total de la línea; totalPresupuesto = suma de todos.
 */
function payloadToPdfData(body) {
  const upperTrim = (val) => String(val || '').trim().toUpperCase();

  const repuestos = (body.repuestos || []).map((r) => ({
    descripcion: upperTrim(r.descripcion),
    cantidad: Math.max(1, parseInt(r.cantidad, 10) || 1),
    valorTotal: Number(r.valor) || 0,
  })).filter((r) => r.descripcion && r.valorTotal > 0);

  const manoDeObra = (body.manoDeObra || []).map((m) => ({
    descripcion: upperTrim(m.descripcion),
    cantidad: Math.max(1, parseInt(m.cantidad, 10) || 1),
    valorTotal: Number(m.valor) || 0,
  })).filter((m) => m.descripcion && m.valorTotal > 0);

  const totalRepuestos = repuestos.reduce((s, r) => s + r.valorTotal, 0);
  const totalManoDeObra = manoDeObra.reduce((s, m) => s + m.valorTotal, 0);
  const subtotalPresupuesto = totalRepuestos + totalManoDeObra;
  // Descuentos: nuevo formato (array) + compatibilidad con descuentoMonto antiguo
  const rawDescuentos = Array.isArray(body.descuentos) ? body.descuentos : [];
  const legacyMonto = Math.max(0, parseInt(body.descuentoMonto, 10) || 0);
  const descuentosInput = rawDescuentos.length > 0
    ? rawDescuentos
    : (legacyMonto > 0 ? [{ monto: legacyMonto, motivo: '' }] : []);

  const descuentosSanitized = descuentosInput.map((d) => ({
    monto: Math.max(0, parseInt(d && d.monto, 10) || 0),
    motivo: upperTrim((d && d.motivo) || ''),
  })).filter((d) => d.monto > 0);

  // Evitar que el total quede negativo: recortar descuentos por orden hasta agotar subtotal
  let restante = subtotalPresupuesto;
  const descuentos = [];
  for (const d of descuentosSanitized) {
    if (restante <= 0) break;
    const aplicado = Math.min(d.monto, restante);
    if (aplicado > 0) {
      descuentos.push({ monto: aplicado, motivo: d.motivo });
      restante -= aplicado;
    }
  }
  const descuentoMonto = descuentos.reduce((s, d) => s + d.monto, 0);
  const totalPresupuesto = subtotalPresupuesto - descuentoMonto;

  const abonoMonto = Math.max(0, parseInt(body.abonoMonto, 10) || 0);
  const aPagarMonto = Math.max(0, parseInt(body.aPagarMonto, 10) || 0);

  const cliente = body.cliente || {};
  const vehiculo = body.vehiculo || {};
  let logoBuffer = null;
  if (body.logo && typeof body.logo === 'string') {
    try {
      logoBuffer = Buffer.from(body.logo, 'base64');
    } catch (_) {}
  }

  return {
    repuestos,
    manoDeObra,
    totalRepuestos,
    totalManoDeObra,
    subtotalPresupuesto,
    descuentos,
    descuentoMonto,
    totalPresupuesto,
    abonoMonto,
    aPagarMonto,
    cliente: {
      nombre: upperTrim(cliente.nombre),
      fecha: upperTrim(cliente.fecha),
      rut: upperTrim(cliente.rut),
      fono: upperTrim(cliente.fono),
    },
    vehiculo: {
      patente: upperTrim(vehiculo.patente),
      ano: upperTrim(vehiculo.ano),
      marca: upperTrim(vehiculo.marca),
      modelo: upperTrim(vehiculo.modelo),
      kilometraje: String(vehiculo.kilometraje || '').trim(),
      vin: upperTrim(vehiculo.vin),
      combustible: upperTrim(vehiculo.combustible),
      color: upperTrim(vehiculo.color),
    },
    logoBuffer,
    presupuestoNumero: upperTrim(body.presupuestoNumero),
    nota: String(body.nota || '').trim(), // Nota final NO en mayúsculas
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (_) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Cuerpo inválido (JSON)' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const data = payloadToPdfData(body);
  if (data.repuestos.length === 0 && data.manoDeObra.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Añada al menos una fila en Repuestos o Mano de Obra' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const orden = body && body.orden ? body.orden : null;
    const pdfBytes = await generatePresupuestoPdf(data, data.logoBuffer, orden);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    return {
      statusCode: 200,
      body: pdfBase64,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="presupuesto.pdf"',
      },
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al generar el PDF', detail: err.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
