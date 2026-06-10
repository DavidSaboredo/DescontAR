import { DIAS } from '../data/mockData'

export function getDiaActual() {
  return DIAS[new Date().getDay()]
}

export function capitalizar(texto) {
  if (!texto) {
    return ''
  }

  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function descuentoAplicaHoy(descuento, diaActual = getDiaActual()) {
  return descuento.diasValidos.includes(diaActual)
}

function includesAny(source = [], expected = []) {
  return source.some((item) => expected.includes(item))
}

export function obtenerCoincidenciasPerfil(descuento, perfil) {
  const coincidencias = []

  if (includesAny(descuento.bancos, perfil.bancos)) {
    coincidencias.push(...descuento.bancos.filter((item) => perfil.bancos.includes(item)))
  }

  if (includesAny(descuento.tarjetas, perfil.tarjetas)) {
    coincidencias.push(
      ...descuento.tarjetas.filter((item) => perfil.tarjetas.includes(item)),
    )
  }

  if (includesAny(descuento.billeteras, perfil.billeteras)) {
    coincidencias.push(
      ...descuento.billeteras.filter((item) => perfil.billeteras.includes(item)),
    )
  }

  if (includesAny(descuento.clubes, perfil.clubes)) {
    coincidencias.push(...descuento.clubes.filter((item) => perfil.clubes.includes(item)))
  }

  return [...new Set(coincidencias)]
}

export function puntuarDescuento(descuento, perfil, diaActual = getDiaActual()) {
  let score = 0

  if (descuentoAplicaHoy(descuento, diaActual)) {
    score += 30
  }

  if (perfil.categoriasFavoritas.includes(descuento.categoria)) {
    score += 20
  }

  score += obtenerCoincidenciasPerfil(descuento, perfil).length * 25

  if (descuento.destacado) {
    score += 10
  }

  return score
}

export function ordenarPorRelevancia(descuentos, perfil, diaActual = getDiaActual()) {
  return [...descuentos].sort((a, b) => {
    const scoreB = puntuarDescuento(b, perfil, diaActual)
    const scoreA = puntuarDescuento(a, perfil, diaActual)

    if (scoreB !== scoreA) {
      return scoreB - scoreA
    }

    return b.porcentaje - a.porcentaje
  })
}

export function filtrarDescuentos(descuentos, filtros, diaActual = getDiaActual()) {
  return descuentos.filter((descuento) => {
    const coincideBusqueda =
      !filtros.busqueda ||
      [
        descuento.titulo,
        descuento.comercio,
        descuento.bancoBilletera,
        descuento.descripcion,
      ]
        .join(' ')
        .toLowerCase()
        .includes(filtros.busqueda.toLowerCase())

    const coincideCategoria =
      filtros.categoria === 'todas' || descuento.categoria === filtros.categoria

    const coincideDia =
      filtros.dia === 'todos'
        ? true
        : filtros.dia === 'hoy'
          ? descuentoAplicaHoy(descuento, diaActual)
          : descuento.diasValidos.includes(filtros.dia)

    return coincideBusqueda && coincideCategoria && coincideDia
  })
}

export function generarId(prefijo) {
  return `${prefijo}-${Math.random().toString(36).slice(2, 9)}`
}
