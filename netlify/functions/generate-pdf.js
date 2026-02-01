const path = require('path');
const { parsePresupuestoExcel } = require(path.join(__dirname, '../../src/parseExcel'));
const { generatePresupuestoPdf } = require(path.join(__dirname, '../../src/generatePdf'));

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
      body: JSON.stringify({ error: 'Cuerpo inválido (JSON con base64)' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const base64 = body.file || body.excel;
  if (!base64) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Falta el campo "file" o "excel" en base64' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (_) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'El archivo no es un base64 válido' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const data = parsePresupuestoExcel(buffer);
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
