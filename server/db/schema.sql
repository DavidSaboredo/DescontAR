create extension if not exists "pgcrypto";

create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  ciudad text not null default 'Concepcion del Uruguay',
  premium boolean not null default false,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  nombre text not null,
  email text not null,
  ciudad text not null,
  notificaciones_activas boolean not null default true,
  hora_alerta text not null default '08:00',
  premium boolean not null default false,
  bancos jsonb not null default '[]'::jsonb,
  tarjetas jsonb not null default '[]'::jsonb,
  billeteras jsonb not null default '[]'::jsonb,
  clubes jsonb not null default '[]'::jsonb,
  categorias_favoritas jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists discounts (
  id text primary key,
  titulo text not null,
  comercio text not null,
  categoria text not null,
  banco_billetera text not null,
  porcentaje integer not null default 0,
  tope text not null default 'Sin tope',
  descripcion text not null,
  dias_validos jsonb not null default '[]'::jsonb,
  horario text not null default 'Todo el dia',
  direccion text not null default '',
  link text not null default '',
  destacado boolean not null default false,
  bancos jsonb not null default '[]'::jsonb,
  tarjetas jsonb not null default '[]'::jsonb,
  billeteras jsonb not null default '[]'::jsonb,
  clubes jsonb not null default '[]'::jsonb,
  source text not null default 'sync',
  synced_at timestamptz
);

create table if not exists favorites (
  user_id uuid not null references users(id) on delete cascade,
  discount_id text not null references discounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, discount_id)
);

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  nombre_lugar text not null,
  tipo_descuento text not null default 'otro',
  descripcion text not null,
  nombre_quien_sugiere text not null default '',
  estado text not null default 'pendiente',
  created_at timestamptz not null default now()
);

create table if not exists device_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'ok',
  message text not null default ''
);
