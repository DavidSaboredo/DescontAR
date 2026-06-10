import 'dotenv/config'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dbPath = process.env.JSON_DB_PATH || path.resolve('server', 'data', 'db.json')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const raw = await fs.readFile(dbPath, 'utf8')
const data = JSON.parse(raw)

const { error } = await client.from('app_state').upsert(
  {
    id: 'default',
    data,
  },
  { onConflict: 'id' },
)

if (error) {
  throw new Error(error.message)
}

console.log('OK: app_state actualizado desde JSON.')
