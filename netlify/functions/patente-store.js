/**
 * Proxy seguro hacia Supabase: búsqueda por prefijo de patente y guardado al generar PDF.
 * Variables en Netlify: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const { createClient } = require('@supabase/supabase-js');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(body),
  };
}

function normalizePatente(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return json(503, {
      ok: false,
      error: 'Supabase no configurado. Añade SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Netlify.',
    });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const exact = normalizePatente(params.patente || '');
    const q = normalizePatente(params.q || '');

    if (exact) {
      const { data, error } = await supabase
        .from('patente_datos')
        .select('patente, cliente, vehiculo, updated_at')
        .eq('patente', exact)
        .maybeSingle();

      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, row: data || null });
    }

    if (!q || q.length < 1) {
      return json(200, { ok: true, items: [] });
    }

    const { data, error } = await supabase
      .from('patente_datos')
      .select('patente, cliente, vehiculo, updated_at')
      .ilike('patente', `${q}%`)
      .order('patente', { ascending: true })
      .limit(20);

    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, items: data || [] });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {
      return json(400, { ok: false, error: 'JSON inválido' });
    }

    const vehiculo = body.vehiculo && typeof body.vehiculo === 'object' ? body.vehiculo : {};
    const patente = normalizePatente(vehiculo.patente || body.patente);
    if (!patente || patente.length < 4) {
      return json(400, { ok: false, error: 'Patente inválida (mín. 4 caracteres alfanuméricos)' });
    }

    const rawCliente = body.cliente && typeof body.cliente === 'object' ? body.cliente : {};
    const cliente = { ...rawCliente };
    delete cliente.fechaIso;

    // Reemplaza todo el registro: patente nueva → insert; patente existente → actualiza cliente/vehículo
    const row = {
      patente,
      cliente,
      vehiculo: { ...vehiculo, patente },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('patente_datos').upsert(row, {
      onConflict: 'patente',
    });

    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, patente });
  }

  return json(405, { ok: false, error: 'Método no permitido' });
};
