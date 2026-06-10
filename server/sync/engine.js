import crypto from 'node:crypto'

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function pick(list, index) {
  if (!list.length) {
    return null
  }
  return list[index % list.length]
}

function stableIndex(seed, mod) {
  const hash = crypto.createHash('sha256').update(seed).digest()
  const num = hash.readUInt32BE(0)
  return mod === 0 ? 0 : num % mod
}

function buildAutoDiscount(date) {
  const key = dayKey(date)
  const categories = [
    {
      categoria: 'supermercado',
      comercio: 'Carrefour Maxi',
      bancoBilletera: 'Cuenta DNI',
      bancos: [],
      billeteras: ['Cuenta DNI'],
      clubes: [],
      tarjetas: [],
      porcentaje: 15,
      horario: '08:00 - 22:00',
      diasValidos: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
      tope: 'Tope segun promos vigentes',
      descripcion: 'Detectado automaticamente. Confirmar condiciones en el link antes de comprar.',
      link: 'https://www.cuentadni.com.ar/',
    },
    {
      categoria: 'farmacia',
      comercio: 'Farmacity',
      bancoBilletera: 'Mercado Pago',
      bancos: [],
      billeteras: ['Mercado Pago'],
      clubes: [],
      tarjetas: [],
      porcentaje: 20,
      horario: '00:00 - 23:59',
      diasValidos: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
      tope: 'Tope segun promos vigentes',
      descripcion: 'Detectado automaticamente. Verificar el medio de pago y tope al pagar.',
      link: 'https://www.mercadopago.com.ar/',
    },
    {
      categoria: 'gastronomia',
      comercio: 'PedidosYa',
      bancoBilletera: 'Banco Nacion',
      bancos: ['Banco Nacion'],
      billeteras: [],
      clubes: [],
      tarjetas: ['Visa', 'Mastercard'],
      porcentaje: 25,
      horario: '18:00 - 23:00',
      diasValidos: ['viernes', 'sabado', 'domingo'],
      tope: 'Tope segun promos vigentes',
      descripcion: 'Detectado automaticamente. Puede requerir cupon o pago con tarjeta adherida.',
      link: 'https://www.pedidosya.com.ar/',
    },
  ]

  const pickIndex = stableIndex(`auto-${key}`, categories.length)
  const base = pick(categories, pickIndex)

  return {
    id: `auto-${key}`,
    titulo: `Nuevo descuento detectado (${key})`,
    comercio: base.comercio,
    categoria: base.categoria,
    bancoBilletera: base.bancoBilletera,
    porcentaje: base.porcentaje,
    tope: base.tope,
    descripcion: base.descripcion,
    diasValidos: base.diasValidos,
    horario: base.horario,
    direccion: '',
    link: base.link,
    destacado: true,
    bancos: base.bancos,
    tarjetas: base.tarjetas,
    billeteras: base.billeteras,
    clubes: base.clubes,
    source: 'sync',
    syncedAt: new Date().toISOString(),
    sponsored: true,
    sponsorName: 'Comercio destacado',
    sponsorUrl: '',
  }
}

function updateHighlights(items, date) {
  const key = dayKey(date)
  const next = items.map((item) => ({ ...item, destacado: false }))
  const highlightCount = Math.min(3, next.length)
  const offset = stableIndex(`highlight-${key}`, Math.max(1, next.length))

  for (let i = 0; i < highlightCount; i += 1) {
    const idx = (offset + i) % next.length
    next[idx] = { ...next[idx], destacado: true }
  }

  return next
}

function fingerprintDiscount(discount) {
  const normalized = {
    titulo: discount.titulo,
    comercio: discount.comercio,
    categoria: discount.categoria,
    bancoBilletera: discount.bancoBilletera,
    porcentaje: discount.porcentaje,
    tope: discount.tope,
    descripcion: discount.descripcion,
    diasValidos: discount.diasValidos,
    horario: discount.horario,
    direccion: discount.direccion,
    link: discount.link,
    destacado: discount.destacado,
    bancos: discount.bancos,
    tarjetas: discount.tarjetas,
    billeteras: discount.billeteras,
    clubes: discount.clubes,
    sponsored: discount.sponsored,
    sponsorName: discount.sponsorName,
    sponsorUrl: discount.sponsorUrl,
  }

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export function runAutomaticSync(currentDb, date = new Date()) {
  const now = new Date().toISOString()
  const autoDiscount = buildAutoDiscount(date)
  const byId = new Map(currentDb.descuentos.map((item) => [item.id, item]))

  const incoming = [autoDiscount, ...currentDb.descuentos.filter((d) => !d.id.startsWith('auto-'))]
  const highlighted = updateHighlights(incoming, date)
  const merged = highlighted.map((item) => ({
    ...item,
    source: item.source || 'sync',
    syncedAt: now,
  }))

  let created = 0
  let updated = 0

  for (const item of merged) {
    const prev = byId.get(item.id)
    if (!prev) {
      created += 1
      continue
    }
    if (fingerprintDiscount(prev) !== fingerprintDiscount(item)) {
      updated += 1
    }
  }

  return {
    nextDb: {
      ...currentDb,
      descuentos: merged,
      meta: {
        ...currentDb.meta,
        lastSyncAt: now,
        lastSyncSummary: {
          created,
          updated,
        },
      },
    },
    summary: {
      created,
      updated,
      lastSyncAt: now,
    },
  }
}

