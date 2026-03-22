-- Ejecutar en Supabase: SQL Editor → New query → Run
-- Tabla mínima para 2 usuarios y poco almacenamiento (plan gratuito).

create table if not exists public.patente_datos (
  patente text primary key,
  cliente jsonb not null default '{}',
  vehiculo jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists idx_patente_datos_updated on public.patente_datos (updated_at desc);

-- RLS sin políticas: la API pública (anon) no ve filas; Netlify Functions usa service_role (bypass).
alter table public.patente_datos enable row level security;

comment on table public.patente_datos is 'Datos cliente/vehículo por patente (presupuestos)';
