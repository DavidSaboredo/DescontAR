import 'dotenv/config'
import path from 'node:path'

export const config = {
  apiPort: Number(process.env.API_PORT || 8787),
  storageDriver: process.env.STORAGE_DRIVER || 'json',
  dbPath: process.env.JSON_DB_PATH || path.resolve('server', 'data', 'db.json'),
  vapidEmail: process.env.VAPID_CONTACT || 'mailto:alertas@descontar.local',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  cronSecret: process.env.CRON_SECRET || '',
  syncEnabled: process.env.SYNC_ENABLED ? process.env.SYNC_ENABLED === 'true' : true,
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
}

export function getPublicConfig() {
  return {
    apiPort: config.apiPort,
    storageDriver: config.storageDriver,
    hasSupabase: Boolean(config.supabaseUrl && config.supabaseAnonKey),
  }
}
