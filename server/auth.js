import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':')

  if (!salt || !hash) {
    return false
  }

  const computedHash = scryptSync(password, salt, 64)
  const originalHash = Buffer.from(hash, 'hex')

  return timingSafeEqual(computedHash, originalHash)
}

export function generateToken() {
  return randomBytes(32).toString('hex')
}

export function sanitizeUser(user) {
  return {
    account: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      ciudad: user.ciudad,
      premium: user.premium,
      createdAt: user.createdAt,
    },
    perfil: user.perfil,
    favoritos: user.favoritos,
    devices: user.devices,
  }
}
