import {
  DESCUENTOS_INICIALES,
  PERFIL_INICIAL,
  SUGERENCIAS_INICIALES,
} from '../src/data/mockData.js'
import { hashPassword } from './auth.js'

function createDemoUser() {
  return {
    id: 'user-demo',
    nombre: PERFIL_INICIAL.nombre,
    email: 'demo@descontar.app',
    ciudad: PERFIL_INICIAL.ciudad,
    premium: PERFIL_INICIAL.premium,
    passwordHash: hashPassword('demo1234'),
    createdAt: new Date().toISOString(),
    perfil: {
      ...PERFIL_INICIAL,
      email: 'demo@descontar.app',
    },
    favoritos: [],
    devices: [],
  }
}

export function createInitialData() {
  return {
    users: [createDemoUser()],
    sessions: [],
    descuentos: DESCUENTOS_INICIALES,
    sugerencias: SUGERENCIAS_INICIALES,
    meta: {
      lastSyncAt: new Date().toISOString(),
      lastAlertAt: null,
    },
  }
}
