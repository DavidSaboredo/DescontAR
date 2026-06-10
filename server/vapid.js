import { promises as fs } from 'node:fs'
import path from 'node:path'
import webPush from 'web-push'
import { config } from './config.js'

const vapidPath = path.resolve('server', 'data', 'vapid.json')

async function ensureKeys() {
  if (config.vapidPublicKey && config.vapidPrivateKey) {
    return {
      publicKey: config.vapidPublicKey,
      privateKey: config.vapidPrivateKey,
    }
  }

  await fs.mkdir(path.dirname(vapidPath), { recursive: true })

  try {
    const raw = await fs.readFile(vapidPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    const keys = webPush.generateVAPIDKeys()
    await fs.writeFile(vapidPath, JSON.stringify(keys, null, 2), 'utf8')
    return keys
  }
}

export async function getVapidPublicKey() {
  const keys = await ensureKeys()
  return keys.publicKey
}

export async function configureWebPush() {
  const keys = await ensureKeys()
  webPush.setVapidDetails(config.vapidEmail, keys.publicKey, keys.privateKey)
}

export async function sendPushNotification(subscription, payload) {
  await configureWebPush()
  return webPush.sendNotification(subscription, JSON.stringify(payload))
}
