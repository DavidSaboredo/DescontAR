import cors from 'cors'
import express from 'express'
import { generateToken, hashPassword, sanitizeUser, verifyPassword } from './auth.js'
import { config, getPublicConfig } from './config.js'
import { readDb, updateDb } from './store.js'
import { checkSupabaseConnection, hasSupabaseServerConfig } from './supabase.js'
import { getVapidPublicKey, sendPushNotification } from './vapid.js'
import { runAutomaticSync } from './sync/engine.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  function getDiaActual() {
    return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][
      new Date().getDay()
    ]
  }

  function includesAny(source = [], expected = []) {
    return source.some((item) => expected.includes(item))
  }

  function matchesPerfil(descuento, perfil) {
    return (
      includesAny(descuento.bancos, perfil.bancos) ||
      includesAny(descuento.tarjetas, perfil.tarjetas) ||
      includesAny(descuento.billeteras, perfil.billeteras) ||
      includesAny(descuento.clubes, perfil.clubes)
    )
  }

  function getUserFromDb(db, token) {
    if (!token) {
      return null
    }

    const session = db.sessions.find((item) => item.token === token)
    if (!session) {
      return null
    }

    return db.users.find((user) => user.id === session.userId) || null
  }

  async function authMiddleware(request, response, next) {
    const db = await readDb()
    const authHeader = request.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const user = getUserFromDb(db, token)

    if (!user) {
      response.status(401).json({ error: 'Necesitas iniciar sesion.' })
      return
    }

    request.db = db
    request.user = user
    request.token = token
    next()
  }

  app.get('/api/health', async (_request, response) => {
    const db = await readDb()
    response.json({
      ok: true,
      config: getPublicConfig(),
      supabaseConfigured: hasSupabaseServerConfig(),
      lastSyncAt: db.meta.lastSyncAt,
      descuentos: db.descuentos.length,
      users: db.users.length,
    })
  })

  app.get('/api/version', (_request, response) => {
    response.json({
      ok: true,
      app: 'DescontAR',
      syncEngine: 'engine-v1',
      storageDriver: config.storageDriver,
    })
  })

  app.get('/api/supabase/health', async (_request, response) => {
    const result = await checkSupabaseConnection()

    if (!result.ok) {
      response.status(503).json(result)
      return
    }

    response.json(result)
  })

  app.get('/api/bootstrap', async (_request, response) => {
    const db = await readDb()
    response.json({
      config: getPublicConfig(),
      descuentos: db.descuentos,
      sugerencias: db.sugerencias,
      meta: db.meta,
      demoCredentials: {
        email: 'demo@descontar.app',
        password: 'demo1234',
      },
    })
  })

  app.post('/api/auth/register', async (request, response) => {
    const { nombre, email, password, ciudad } = request.body

    if (!nombre || !email || !password) {
      response.status(400).json({ error: 'Nombre, email y password son obligatorios.' })
      return
    }

    const normalizedEmail = email.toLowerCase().trim()
    const token = generateToken()

    const db = await updateDb((current) => {
      if (current.users.some((user) => user.email === normalizedEmail)) {
        throw new Error('EMAIL_EXISTS')
      }

      const user = {
        id: `user-${Date.now()}`,
        nombre,
        email: normalizedEmail,
        ciudad: ciudad || 'Concepcion del Uruguay',
        premium: false,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        perfil: {
          nombre,
          email: normalizedEmail,
          ciudad: ciudad || 'Concepcion del Uruguay',
          notificacionesActivas: true,
          horaAlerta: '08:00',
          premium: false,
          bancos: [],
          tarjetas: [],
          billeteras: [],
          clubes: [],
          categoriasFavoritas: ['banco', 'billetera', 'supermercado'],
        },
        favoritos: [],
        devices: [],
      }

      return {
        ...current,
        users: [...current.users, user],
        sessions: [
          ...current.sessions.filter((session) => session.userId !== user.id),
          { token, userId: user.id, createdAt: new Date().toISOString() },
        ],
      }
    }).catch((error) => {
      if (error.message === 'EMAIL_EXISTS') {
        return null
      }

      throw error
    })

    if (!db) {
      response.status(409).json({ error: 'Ese email ya esta registrado.' })
      return
    }

    const user = db.users.find((item) => item.email === normalizedEmail)
    response.status(201).json({
      token,
      ...sanitizeUser(user),
    })
  })

  app.post('/api/auth/login', async (request, response) => {
    const { email, password } = request.body
    const normalizedEmail = email?.toLowerCase().trim()
    const db = await readDb()
    const user = db.users.find((item) => item.email === normalizedEmail)

    if (!user || !verifyPassword(password || '', user.passwordHash)) {
      response.status(401).json({ error: 'Credenciales invalidas.' })
      return
    }

    const token = generateToken()

    await updateDb((current) => ({
      ...current,
      sessions: [
        ...current.sessions.filter((session) => session.userId !== user.id),
        { token, userId: user.id, createdAt: new Date().toISOString() },
      ],
    }))

    response.json({
      token,
      ...sanitizeUser(user),
    })
  })

  app.get('/api/auth/me', authMiddleware, async (request, response) => {
    response.json(sanitizeUser(request.user))
  })

  app.post('/api/auth/logout', authMiddleware, async (request, response) => {
    await updateDb((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.token !== request.token),
    }))

    response.json({ ok: true })
  })

  app.get('/api/descuentos', async (request, response) => {
    const db = await readDb()
    const dia = request.query.dia
    const categoria = request.query.categoria
    const q = request.query.q?.toLowerCase()
    const personalized = request.query.personalized === 'true'
    const authHeader = request.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const user = getUserFromDb(db, token) || db.users[0]

    let descuentos = db.descuentos

    if (dia && dia !== 'todos') {
      descuentos = descuentos.filter((descuento) => descuento.diasValidos.includes(dia))
    }

    if (categoria && categoria !== 'todas') {
      descuentos = descuentos.filter((descuento) => descuento.categoria === categoria)
    }

    if (q) {
      descuentos = descuentos.filter((descuento) =>
        [descuento.titulo, descuento.comercio, descuento.bancoBilletera, descuento.descripcion]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }

    if (personalized) {
      descuentos = descuentos.filter((descuento) => matchesPerfil(descuento, user.perfil))
    }

    response.json({
      items: descuentos,
      total: descuentos.length,
    })
  })

  app.patch('/api/perfil', authMiddleware, async (request, response) => {
    const { updates } = request.body

    if (!updates || typeof updates !== 'object') {
      response.status(400).json({ error: 'Faltan actualizaciones de perfil.' })
      return
    }

    const db = await updateDb((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === request.user.id
          ? {
              ...user,
              nombre: updates.nombre ?? user.nombre,
              email: updates.email ?? user.email,
              ciudad: updates.ciudad ?? user.ciudad,
              premium: updates.premium ?? user.premium,
              perfil: {
                ...user.perfil,
                ...updates,
              },
            }
          : user,
      ),
    }))

    const updatedUser = db.users.find((user) => user.id === request.user.id)

    response.json(sanitizeUser(updatedUser))
  })

  app.post('/api/favoritos/toggle', authMiddleware, async (request, response) => {
    const { descuentoId } = request.body

    if (!descuentoId) {
      response.status(400).json({ error: 'Falta descuentoId.' })
      return
    }

    const db = await updateDb((current) => ({
      ...current,
      users: current.users.map((user) => {
        if (user.id !== request.user.id) {
          return user
        }

        const favoritos = user.favoritos.includes(descuentoId)
          ? user.favoritos.filter((id) => id !== descuentoId)
          : [...user.favoritos, descuentoId]

        return { ...user, favoritos }
      }),
    }))

    const updatedUser = db.users.find((user) => user.id === request.user.id)
    response.json({ favoritos: updatedUser.favoritos })
  })

  app.post('/api/sugerencias', async (request, response) => {
    const { nombreLugar, tipoDescuento, descripcion, nombreQuienSugiere } = request.body

    if (!nombreLugar || !descripcion) {
      response.status(400).json({ error: 'Nombre del lugar y descripcion son obligatorios.' })
      return
    }

    const nuevaSugerencia = {
      id: `sug-${Date.now()}`,
      nombreLugar,
      tipoDescuento: tipoDescuento || 'otro',
      descripcion,
      nombreQuienSugiere: nombreQuienSugiere || '',
      estado: 'pendiente',
    }

    const db = await updateDb((current) => ({
      ...current,
      sugerencias: [nuevaSugerencia, ...current.sugerencias],
    }))

    response.status(201).json({
      sugerencia: nuevaSugerencia,
      sugerencias: db.sugerencias,
    })
  })

  app.get('/api/alertas/preview', async (request, response) => {
    const db = await readDb()
    const authHeader = request.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const user = getUserFromDb(db, token) || db.users[0]
    const hoy = getDiaActual()
    const items = db.descuentos
      .filter((descuento) => descuento.diasValidos.includes(hoy))
      .filter((descuento) => matchesPerfil(descuento, user.perfil))
      .slice(0, 3)

    await updateDb((current) => ({
      ...current,
      meta: {
        ...current.meta,
        lastAlertAt: new Date().toISOString(),
      },
    }))

    response.json({
      hora: user.perfil.horaAlerta,
      items,
      message:
        items.length > 0
          ? `Hoy tenes ${items.length} descuentos para usar con tus medios de pago.`
          : 'Hoy no se detectaron descuentos personalizados nuevos.',
    })
  })

  app.get('/api/push/public-key', async (_request, response) => {
    const publicKey = await getVapidPublicKey()
    response.json({ publicKey })
  })

  app.post('/api/push/subscribe', authMiddleware, async (request, response) => {
    const { subscription } = request.body

    if (!subscription?.endpoint) {
      response.status(400).json({ error: 'Suscripcion push invalida.' })
      return
    }

    const db = await updateDb((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === request.user.id
          ? {
              ...user,
              devices: [
                ...user.devices.filter((item) => item.endpoint !== subscription.endpoint),
                {
                  endpoint: subscription.endpoint,
                  keys: subscription.keys,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : user,
      ),
    }))

    const updatedUser = db.users.find((user) => user.id === request.user.id)
    response.status(201).json({ devices: updatedUser.devices })
  })

  app.post('/api/push/test', authMiddleware, async (request, response) => {
    if (request.user.devices.length === 0) {
      response.status(400).json({ error: 'No hay dispositivos suscriptos para este usuario.' })
      return
    }

    const payload = {
      title: 'DescontAR',
      body: 'Hoy tenes descuentos nuevos para revisar en la app.',
      url: '/',
    }

    const results = await Promise.allSettled(
      request.user.devices.map((device) => sendPushNotification(device, payload)),
    )

    response.json({
      ok: true,
      sent: results.filter((result) => result.status === 'fulfilled').length,
      failed: results.filter((result) => result.status === 'rejected').length,
    })
  })

  app.post('/api/sync/run', async (_request, response) => {
    if (config.cronSecret) {
      const incoming =
        _request.headers['x-cron-secret'] ||
        _request.query?.secret ||
        _request.body?.secret ||
        ''

      if (incoming !== config.cronSecret) {
        response.status(401).json({ error: 'No autorizado.' })
        return
      }
    }

    const result = await updateDb((current) => {
      const { nextDb, summary } = runAutomaticSync(current, new Date())
      return {
        ...nextDb,
        meta: {
          ...nextDb.meta,
          lastSyncSummary: summary,
        },
      }
    })

    const summary = result.meta.lastSyncSummary

    response.json({
      ok: true,
      lastSyncAt: result.meta.lastSyncAt,
      summary,
      message:
        summary.created + summary.updated > 0
          ? `Se actualizaron descuentos: +${summary.created} nuevos, ${summary.updated} modificados.`
          : 'No hubo cambios detectados.',
    })
  })

  return app
}

export function createLocalServer() {
  const app = createApp()
  const port = config.apiPort
  const server = app.listen(port, () => {
    console.log(`API DescontAR lista en http://localhost:${port}`)
  })

  if (config.syncEnabled) {
    const intervalMs = Math.max(1, config.syncIntervalMinutes) * 60_000
    setInterval(async () => {
      await updateDb((current) => runAutomaticSync(current, new Date()).nextDb)
    }, intervalMs)
  }

  return server
}
