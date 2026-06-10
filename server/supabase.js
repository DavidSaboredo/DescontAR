import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

let adminClient = null

export function hasSupabaseServerConfig() {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey)
}

export function getSupabaseAdmin() {
  if (!hasSupabaseServerConfig()) {
    return null
  }

  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return adminClient
}

export async function checkSupabaseConnection() {
  const client = getSupabaseAdmin()

  if (!client) {
    return {
      ok: false,
      reason: 'missing_config',
    }
  }

  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  })

  if (error) {
    return {
      ok: false,
      reason: error.message,
    }
  }

  return {
    ok: true,
    usersFetched: data?.users?.length ?? 0,
  }
}
