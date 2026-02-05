const { PDFDocument } = require('pdf-lib');

const PREFIX = 'PRESUPUESTOS_ORDEN_V1:';

function tryGet(doc, methodName) {
  try {
    return typeof doc[methodName] === 'function' ? (doc[methodName]() || '') : '';
  } catch (_) {
    return '';
  }
}

function extractOrdenFromInfoString(infoValue) {
  const s = String(infoValue || '').trim();
  if (!s.startsWith(PREFIX)) return null;
  const b64 = s.slice(PREFIX.length).trim();
  if (!b64) return null;
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json);
}

exports.handler = async (event) => {
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

  const pdfBase64 = body && body.pdfBase64;
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Falta pdfBase64' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const doc = await PDFDocument.load(pdfBytes);

    const subject = tryGet(doc, 'getSubject');
    const keywords = tryGet(doc, 'getKeywords');
    const title = tryGet(doc, 'getTitle');

    const orden =
      extractOrdenFromInfoString(subject) ||
      extractOrdenFromInfoString(keywords) ||
      extractOrdenFromInfoString(title);

    if (!orden) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Este PDF no contiene datos para retomar la orden (solo funciona con PDFs nuevos).' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ orden }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al leer el PDF', detail: err.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

