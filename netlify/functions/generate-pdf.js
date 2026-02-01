const path = require('path');
const { generatePresupuestoPdf } = require(path.join(__dirname, '../../src/generatePdf'));

/**
 * Convierte el payload de la web (repuestos/manoDeObra con descripcion, cantidad, valor)
 * al formato que espera generatePdf (descripcion, valorTotal).
 * Valor se interpreta como total de la línea; totalPresupuesto = suma de todos.
 */
function payloadToPdfData(body) {
  const repuestos = (body.repuestos || []).map((r) => ({
    descripcion: String(r.descripcion || '').trim(),
    valorTotal: Number(r.valor) || 0,
  })).filter((r) => r.descripcion);

  const manoDeObra = (body.manoDeObra || []).map((m) => ({
    descripcion: String(m.descripcion || '').trim(),
    valorTotal: Number(m.valor) || 0,
  })).filter((m) => m.descripcion);

  const totalRepuestos = repuestos.reduce((s, r) => s + r.valorTotal, 0);
  const totalManoDeObra = manoDeObra.reduce((s, m) => s + m.valorTotal, 0);
  const totalPresupuesto = totalRepuestos + totalManoDeObra;

  return {
    repuestos,
    manoDeObra,
    totalRepuestos,
    totalManoDeObra,
    totalPresupuesto,
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
      body: JSON.stringify({ error: 'Añade al menos una fila en Repuestos o Mano de Obra' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const pdfBytes = await generatePresupuestoPdf(data);
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
