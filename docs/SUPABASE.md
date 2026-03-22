# Patentes en la nube (Supabase, plan gratuito)

Para 2 usuarios y poco almacenamiento el **plan Free** de Supabase suele ser **0 USD/mes** (límites generosos de base de datos; revisa [precios actuales](https://supabase.com/pricing)).

## 1. Crear proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto.
2. En **SQL Editor**, ejecuta el contenido de `supabase/patente_datos.sql` (crea la tabla `patente_datos`).

## 2. Credenciales (solo servidor)

En el panel de Supabase: **Project Settings → API**

- **Project URL** → `SUPABASE_URL`
- **service_role** (secreto, no lo pongas en el frontend) → `SUPABASE_SERVICE_ROLE_KEY`

La app **no** expone estas claves: solo las usan las Netlify Functions.

## 3. Variables en Netlify

En tu sitio: **Site configuration → Environment variables**, añade:

| Variable | Valor |
|----------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role) |

Despliega de nuevo (o `netlify dev` lee un `.env` local).

## 4. Desarrollo local

En la raíz del repo puedes crear `.env` (no subir a git):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`netlify dev` carga estas variables para las funciones.

## Comportamiento

- Al **generar un PDF** con éxito, se guarda o actualiza cliente + vehículo asociados a la **patente** (normalizada: solo letras y números en mayúsculas).
- **Patente nueva:** se crea fila. **Patente ya existente:** se **reemplazan** por completo `cliente` y `vehiculo` con lo que venga en el formulario (última orden guardada).
- La **fecha de la orden** no se guarda en la nube: cada presupuesto usa la fecha del día en el formulario; al elegir una patente sugerida se pone la fecha de **hoy**.
- Al **escribir la patente**, se muestran sugerencias desde la base (prefijo).
- Si **no** configuraste Supabase en Netlify, la función responde 503 y la web sigue funcionando sin sugerencias ni guardado.

## Dependencia

```bash
npm install
```

Instala `@supabase/supabase-js` usada por `netlify/functions/patente-store.js`.
