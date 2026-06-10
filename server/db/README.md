# Base Real

Este directorio deja preparado el paso de desarrollo local a una base real.

## Objetivo

Hoy la app corre con `STORAGE_DRIVER=json`, usando `server/data/db.json`.

El esquema de `schema.sql` refleja la estructura objetivo para:

- usuarios
- perfiles
- sesiones
- descuentos
- favoritos
- sugerencias
- dispositivos para push
- corridas de sincronizacion

## Proximo Paso Recomendado

1. Crear un proyecto en Supabase o una base Postgres.
2. Ejecutar `server/db/schema.sql`.
3. Crear el estado inicial en `app_state` (una sola vez):

```sql
insert into app_state (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
```

4. Completar `.env` con:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Configurar `STORAGE_DRIVER=supabase`.

## Estrategia De Migracion

1. Exportar el contenido actual de `server/data/db.json`.
2. Insertar usuarios y perfiles.
3. Insertar descuentos y sugerencias.
4. Convertir favoritos por usuario.
5. Migrar suscripciones push desde `devices`.
6. Cambiar `STORAGE_DRIVER` de `json` a `supabase` o `postgres`.

## Nota

La idea es que `index.js` no cambie demasiado al migrar. El cambio fuerte tiene que quedar aislado en la capa de persistencia.
