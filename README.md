# DescontAR

App mobile-first para Concepcion del Uruguay orientada a descubrir descuentos vigentes y avisar automaticamente al usuario segun:

- bancos
- tarjetas
- billeteras
- clubes de beneficios
- categorias favoritas

## Estado Actual

El proyecto ya incluye:

- frontend en React + Vite
- backend local con Express
- login, registro y sesion por token
- perfil por usuario
- favoritos por usuario
- sugerencias comunitarias
- estructura de push notifications
- service worker para notificaciones web
- persistencia local de desarrollo
- esquema SQL preparado para una base real
- motor de sync automatico local (timer) y endpoint para cron en produccion

## Scripts

```bash
npm run dev:web
npm run dev:api
npm run build
npm run lint
```

## Desarrollo Local

1. Instalar dependencias:

```bash
npm install
```

2. Levantar la API:

```bash
npm run dev:api
```

3. Levantar el frontend:

```bash
npm run dev
```

## Demo

Usuario demo:

- `demo@descontar.app`
- `demo1234`

## Variables De Entorno

Copiar `.env.example` a `.env` si queres personalizar puertos o preparar produccion.

Variables disponibles:

- `API_PORT`
- `STORAGE_DRIVER`
- `JSON_DB_PATH`
- `VAPID_CONTACT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Persistencia

### Desarrollo

- `STORAGE_DRIVER=json`
- archivo local: `server/data/db.json`
- el motor de sync corre cada `SYNC_INTERVAL_MINUTES` (default 5) cuando usas `npm run dev:api`

### Produccion Objetivo

- Postgres o Supabase
- esquema inicial en `server/db/schema.sql`
- guia de migracion en `server/db/README.md`

## Estructura Relevante

- frontend principal: `src/App.jsx`
- API frontend: `src/api/backend.js`
- backend local: `server/index.js`
- backend compartido: `server/app.js`
- Vercel serverless: `api/index.js`
- auth: `server/auth.js`
- store local: `server/store.js`
- push/VAPID: `server/vapid.js`
- service worker: `public/sw.js`

## Deploy En Vercel

1. Subir el repo a GitHub.
2. Crear el proyecto en Vercel importando el repo.
3. En Supabase, ejecutar `server/db/schema.sql` y luego crear el estado inicial:

```sql
insert into app_state (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
```

4. Migrar el JSON local a Supabase (una sola vez):

```bash
npm run migrate:supabase-state
```

5. Configurar variables de entorno en Vercel:
   - `STORAGE_DRIVER=supabase`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VAPID_CONTACT`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `CRON_SECRET` (si queres proteger el endpoint)
   - `SYNC_ENABLED=false` (en Vercel no corre timer, usar cron)

6. Crear un Cron en Vercel (Dashboard) que pegue a:
   - `POST https://TU-DOMINIO/api/sync/run?secret=TU_CRON_SECRET`

## Proximo Paso Recomendado

1. Implementar adaptador real para Supabase/Postgres.
2. Mover usuarios, perfiles y favoritos a la base real.
3. Guardar subscriptions push en produccion.
4. Conectar un motor real de sync automatico de descuentos.
5. Disparar alertas reales segun el perfil del usuario.
