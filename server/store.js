import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createInitialData } from './defaultData.js'
import { hashPassword } from './auth.js'
import { config } from './config.js'
import { getSupabaseAdmin } from './supabase.js'

const dbPath = config.dbPath
const dataDir = path.dirname(dbPath)
const defaultStateId = 'default'
const supabaseTable = 'app_state'

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(dbPath)
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(createInitialData(), null, 2), 'utf8')
  }
}

function migrateDb(data) {
  if (data.users && data.sessions) {
    return data
  }

  const demoUser = {
    id: data.account?.id || 'user-demo',
    nombre: data.account?.nombre || 'Demo Usuario',
    email: 'demo@descontar.app',
    ciudad: data.account?.ciudad || 'Concepcion del Uruguay',
    premium: data.account?.premium ?? false,
    passwordHash: hashPassword('demo1234'),
    createdAt: new Date().toISOString(),
    perfil: {
      ...(data.perfil || {}),
      email: 'demo@descontar.app',
    },
    favoritos: data.favoritos || [],
    devices: [],
  }

  return {
    users: [demoUser],
    sessions: [],
    descuentos: data.descuentos || [],
    sugerencias: data.sugerencias || [],
    meta: data.meta || {
      lastSyncAt: new Date().toISOString(),
      lastAlertAt: null,
    },
  }
}

function isSupabaseStorage() {
  return config.storageDriver === 'supabase'
}

async function readDbFromSupabase() {
  const client = getSupabaseAdmin()

  if (!client) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }

  const { data, error } = await client
    .from(supabaseTable)
    .select('data')
    .eq('id', defaultStateId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.data) {
    const initial = createInitialData()
    const migrated = migrateDb(initial)
    await writeDbToSupabase(migrated)
    return migrated
  }

  return migrateDb(data.data)
}

async function writeDbToSupabase(nextData) {
  const client = getSupabaseAdmin()

  if (!client) {
    throw new Error('SUPABASE_NOT_CONFIGURED')
  }

  const { error } = await client.from(supabaseTable).upsert(
    {
      id: defaultStateId,
      data: nextData,
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw new Error(error.message)
  }

  return nextData
}

export async function readDb() {
  if (isSupabaseStorage()) {
    return readDbFromSupabase()
  }

  await ensureDb()
  const raw = await fs.readFile(dbPath, 'utf8')
  const parsed = migrateDb(JSON.parse(raw))
  await writeDb(parsed)
  return parsed
}

export async function writeDb(nextData) {
  if (isSupabaseStorage()) {
    return writeDbToSupabase(nextData)
  }

  await ensureDb()
  await fs.writeFile(dbPath, JSON.stringify(nextData, null, 2), 'utf8')
  return nextData
}

export async function updateDb(updater) {
  const current = await readDb()
  const nextData = await updater(current)
  return writeDb(nextData)
}
