import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  clearStoredToken,
  createSugerencia,
  fetchAlertPreview,
  fetchBootstrap,
  fetchMe,
  fetchPushPublicKey,
  getStoredToken,
  login,
  logout,
  register,
  runSyncPreview,
  savePerfil,
  sendTestPush,
  setStoredToken,
  subscribePushDevice,
  toggleFavoritoApi,
} from './api/backend'
import {
  BANCOS,
  BILLETERAS,
  CATEGORIAS,
  CLUBES,
  DESCUENTOS_INICIALES,
  DIAS,
  HORARIOS_ALERTA,
  PERFIL_INICIAL,
  SUGERENCIAS_INICIALES,
  TARJETAS,
} from './data/mockData'
import {
  capitalizar,
  descuentoAplicaHoy,
  filtrarDescuentos,
  getDiaActual,
  obtenerCoincidenciasPerfil,
  ordenarPorRelevancia,
  puntuarDescuento,
} from './utils/descuentos'

const VISTAS = [
  { id: 'hoy', label: 'Hoy', icon: '⌂' },
  { id: 'todos', label: 'Todos', icon: '▦' },
  { id: 'favoritos', label: 'Favoritos', icon: '☆' },
  { id: 'alertas', label: 'Alertas', icon: '◌' },
  { id: 'cuenta', label: 'Mi cuenta', icon: '◎' },
]

function usePersistedState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = window.localStorage.getItem(key)
    return saved ? JSON.parse(saved) : initialValue
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

function App() {
  const diaActual = getDiaActual()
  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  })

  const [vistaActiva, setVistaActiva] = useState('hoy')
  const [descuentos, setDescuentos] = usePersistedState(
    'descontar-descuentos',
    DESCUENTOS_INICIALES,
  )
  const [favoritos, setFavoritos] = usePersistedState('descontar-favoritos', [])
  const [perfil, setPerfil] = usePersistedState('descontar-perfil', PERFIL_INICIAL)
  const [sugerencias, setSugerencias] = usePersistedState(
    'descontar-sugerencias',
    SUGERENCIAS_INICIALES,
  )
  const [meta, setMeta] = usePersistedState('descontar-meta', {
    lastSyncAt: null,
    lastSyncSummary: null,
    lastAlertAt: null,
  })
  const [nowTick, setNowTick] = useState(0)
  const [detalleActivo, setDetalleActivo] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [backendStatus, setBackendStatus] = useState('conectando')
  const [authUser, setAuthUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    nombre: '',
    email: 'demo@descontar.app',
    password: 'demo1234',
    ciudad: 'Concepcion del Uruguay',
  })
  const [alertPreview, setAlertPreview] = useState(null)
  const [pushStatus, setPushStatus] = useState('idle')
  const [filtros, setFiltros] = useState({
    busqueda: '',
    categoria: 'todas',
    dia: 'todos',
  })
  const [sugerenciaForm, setSugerenciaForm] = useState({
    nombreLugar: '',
    tipoDescuento: 'supermercado',
    descripcion: '',
    nombreQuienSugiere: '',
  })

  useEffect(() => {
    if (!mensaje) {
      return undefined
    }

    const timeout = window.setTimeout(() => setMensaje(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [mensaje])

  useEffect(() => {
    function tick() {
      setNowTick(Date.now())
    }

    tick()
    const interval = window.setInterval(tick, 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const data = await fetchBootstrap()

        if (!active) {
          return
        }

        const prevLastSyncAt = meta.lastSyncAt
        setDescuentos(data.descuentos)
        setSugerencias(data.sugerencias)
        setMeta(data.meta || meta)
        setBackendStatus('conectado')

        const token = getStoredToken()

        if (token) {
          try {
            const me = await fetchMe()
            if (active) {
              setAuthUser(me.account)
              setFavoritos(me.favoritos)
              setPerfil(me.perfil)
            }
          } catch {
            clearStoredToken()
          }
        }

        const preview = await fetchAlertPreview()
        if (active) {
          setAlertPreview(preview)
        }

        if (prevLastSyncAt && data.meta?.lastSyncAt && prevLastSyncAt !== data.meta.lastSyncAt) {
          setMensaje('✅ Descuentos actualizados automaticamente.')
        }
      } catch {
        if (active) {
          setBackendStatus('local')
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [meta, setDescuentos, setFavoritos, setMeta, setPerfil, setSugerencias])

  useEffect(() => {
    if (backendStatus !== 'conectado') {
      return undefined
    }

    let active = true

    async function refresh() {
      try {
        const data = await fetchBootstrap()
        if (!active) {
          return
        }
        if (data?.descuentos) {
          setDescuentos(data.descuentos)
        }
        if (data?.sugerencias) {
          setSugerencias(data.sugerencias)
        }
        if (data?.meta) {
          setMeta(data.meta)
        }
      } catch {
        if (active) {
          setBackendStatus('local')
        }
      }
    }

    const interval = window.setInterval(refresh, 5 * 60 * 1000)

    function onFocus() {
      refresh()
    }

    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [backendStatus, setDescuentos, setMeta, setSugerencias])

  const descuentosOrdenados = useMemo(
    () => ordenarPorRelevancia(descuentos, perfil, diaActual),
    [descuentos, perfil, diaActual],
  )

  const descuentosHoy = useMemo(
    () => descuentosOrdenados.filter((descuento) => descuentoAplicaHoy(descuento, diaActual)),
    [descuentosOrdenados, diaActual],
  )

  const descuentosParaVosHoy = useMemo(
    () =>
      descuentosHoy.filter((descuento) => puntuarDescuento(descuento, perfil, diaActual) >= 50),
    [descuentosHoy, perfil, diaActual],
  )

  const destacadosDelDia = useMemo(() => {
    const fuente = descuentosParaVosHoy.length > 0 ? descuentosParaVosHoy : descuentosHoy
    return fuente.filter((descuento) => descuento.destacado).slice(0, 3)
  }, [descuentosParaVosHoy, descuentosHoy])

  const descuentosFiltrados = useMemo(
    () => ordenarPorRelevancia(filtrarDescuentos(descuentos, filtros, diaActual), perfil, diaActual),
    [descuentos, filtros, perfil, diaActual],
  )

  const sugerenciasPendientes = useMemo(
    () => sugerencias.filter((sugerencia) => sugerencia.estado === 'pendiente').length,
    [sugerencias],
  )

  const favoritosLista = useMemo(
    () => descuentosOrdenados.filter((descuento) => favoritos.includes(descuento.id)),
    [descuentosOrdenados, favoritos],
  )

  const resumenCategorias = useMemo(
    () =>
      Object.entries(CATEGORIAS)
        .map(([id, categoria]) => ({
          id,
          ...categoria,
          cantidad: descuentosHoy.filter((descuento) => descuento.categoria === id).length,
        }))
        .filter((categoria) => categoria.cantidad > 0),
    [descuentosHoy],
  )

  const ultimaSyncLabel = useMemo(() => {
    if (!meta?.lastSyncAt) {
      return null
    }

    const last = new Date(meta.lastSyncAt)
    const diffMs = nowTick - last.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) {
      return 'Recién actualizado'
    }
    if (mins < 60) {
      return `Actualizado hace ${mins} min`
    }
    const hours = Math.floor(mins / 60)
    return `Actualizado hace ${hours} h`
  }, [meta, nowTick])

  async function toggleFavorito(id) {
    if (!authUser) {
      setMensaje('Inicia sesion para sincronizar favoritos entre dispositivos.')
      return
    }

    const optimistic = favoritos.includes(id)
      ? favoritos.filter((favoritoId) => favoritoId !== id)
      : [...favoritos, id]

    setFavoritos(optimistic)

    try {
      const data = await toggleFavoritoApi(id)
      setFavoritos(data.favoritos)
    } catch {
      setFavoritos(favoritos)
      setMensaje('No se pudo sincronizar el favorito con la API.')
    }
  }

  async function persistirPerfil(updates, nextPerfil) {
    if (!authUser) {
      setPerfil(nextPerfil)
      setMensaje('Crea una cuenta para guardar tu perfil en la nube.')
      return
    }

    try {
      const data = await savePerfil(updates)
      setAuthUser(data.account)
      setPerfil(data.perfil)

      if (backendStatus === 'conectado') {
        const preview = await fetchAlertPreview()
        setAlertPreview(preview)
      }
    } catch {
      setPerfil(nextPerfil)
      setMensaje('El perfil quedo guardado solo en este dispositivo.')
    }
  }

  function actualizarPerfil(campo, valor) {
    const nextPerfil = { ...perfil, [campo]: valor }
    setPerfil(nextPerfil)
    persistirPerfil({ [campo]: valor }, nextPerfil)
  }

  function togglePerfilArray(campo, valor) {
    const nextValue = perfil[campo].includes(valor)
      ? perfil[campo].filter((item) => item !== valor)
      : [...perfil[campo], valor]

    const nextPerfil = {
      ...perfil,
      [campo]: nextValue,
    }

    setPerfil(nextPerfil)
    persistirPerfil({ [campo]: nextValue }, nextPerfil)
  }

  async function handleEnviarSugerencia(event) {
    event.preventDefault()

    try {
      const data = await createSugerencia(sugerenciaForm)
      setSugerencias(data.sugerencias)
    } catch {
      setMensaje('No se pudo enviar la sugerencia a la API.')
      return
    }

    setSugerenciaForm({
      nombreLugar: '',
      tipoDescuento: 'supermercado',
      descripcion: '',
      nombreQuienSugiere: '',
    })
    setMensaje('Tu sugerencia fue enviada para revision.')
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()

    try {
      const data =
        authMode === 'login'
          ? await login({
              email: authForm.email,
              password: authForm.password,
            })
          : await register(authForm)

      setStoredToken(data.token)
      setAuthUser(data.account)
      setPerfil(data.perfil)
      setFavoritos(data.favoritos)
      setMensaje(authMode === 'login' ? 'Sesion iniciada.' : 'Cuenta creada correctamente.')

      const preview = await fetchAlertPreview()
      setAlertPreview(preview)
    } catch (error) {
      setMensaje(error.message)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // noop
    }

    clearStoredToken()
    setAuthUser(null)
    setFavoritos([])
    setPerfil(PERFIL_INICIAL)
    setMensaje('Sesion cerrada.')
  }

  async function handleEnablePush() {
    if (!authUser) {
      setMensaje('Inicia sesion para vincular este dispositivo.')
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported')
      setMensaje('Este navegador no soporta push web.')
      return
    }

    try {
      setPushStatus('loading')
      const registration = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()

      if (permission !== 'granted') {
        setPushStatus('denied')
        setMensaje('Necesitas permitir notificaciones para activar las alertas.')
        return
      }

      const { publicKey } = await fetchPushPublicKey()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await subscribePushDevice(subscription.toJSON())
      setPushStatus('enabled')
      setMensaje('Dispositivo vinculado para recibir alertas.')
    } catch (error) {
      setPushStatus('error')
      setMensaje(error.message || 'No se pudo activar el dispositivo.')
    }
  }

  async function handleTestPush() {
    try {
      const result = await sendTestPush()
      setMensaje(`Push enviado. Exitos: ${result.sent}, fallidos: ${result.failed}.`)
    } catch (error) {
      setMensaje(error.message)
    }
  }

  async function simularSync() {
    try {
      const result = await runSyncPreview()
      setMensaje(`Sync listo: ${new Date(result.lastSyncAt).toLocaleTimeString('es-AR')}`)
    } catch {
      setMensaje('La API de sync no esta disponible.')
    }
  }

  return (
    <div className="app-shell">
      {mensaje ? <div className="inline-toast">{mensaje}</div> : null}

      <main className="content-stack">
        {vistaActiva === 'hoy' ? (
          <>
            <section className="hero-panel">
              <div className="hero-city">Concepcion del Uruguay, Entre Rios</div>
              <h1>Hoy es {capitalizar(diaActual)}!</h1>
              <p className="hero-date">{fechaHoy}</p>
              <button
                type="button"
                className="hero-chip"
                onClick={() => setVistaActiva('todos')}
              >
                ✨ {descuentosParaVosHoy.length || descuentosHoy.length} descuentos disponibles hoy
              </button>
              <div className="hero-status">
                {backendStatus === 'conectado'
                  ? 'API conectada y lista para cuentas/alertas reales'
                  : 'Modo local: la app sigue funcionando mientras armamos el backend real'}
              </div>
              {ultimaSyncLabel ? <div className="hero-status subtle">{ultimaSyncLabel}</div> : null}
            </section>

            <SectionTitle
              title="Destacados del dia"
              subtitle="Promociones vigentes ordenadas segun tu perfil"
            />

            <div className="card-list">
              {destacadosDelDia.map((descuento) => (
                <DiscountCard
                  key={descuento.id}
                  descuento={descuento}
                  esFavorito={favoritos.includes(descuento.id)}
                  coincidencias={obtenerCoincidenciasPerfil(descuento, perfil)}
                  onFavorito={toggleFavorito}
                  onAbrir={setDetalleActivo}
                />
              ))}
            </div>

            <div className="filter-strip">
              <button
                type="button"
                className="chip-button active dark"
                onClick={() => {
                  setFiltros({ busqueda: '', categoria: 'todas', dia: 'hoy' })
                  setVistaActiva('todos')
                }}
              >
                ✨ Todos
              </button>
              {resumenCategorias.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  className="chip-button"
                  style={{
                    color: categoria.accent,
                    backgroundColor: categoria.color,
                    borderColor: categoria.border,
                  }}
                  onClick={() => {
                    setFiltros({ busqueda: '', categoria: categoria.id, dia: 'hoy' })
                    setVistaActiva('todos')
                  }}
                >
                  {categoria.emoji} {categoria.label}
                </button>
              ))}
            </div>

            <SectionTitle
              title="Todos los descuentos de hoy"
              subtitle={`${descuentosHoy.length} resultados`}
            />

            <div className="card-list">
              {(descuentosParaVosHoy.length > 0 ? descuentosParaVosHoy : descuentosHoy).map(
                (descuento) => (
                  <DiscountCard
                    key={descuento.id}
                    descuento={descuento}
                    esFavorito={favoritos.includes(descuento.id)}
                    coincidencias={obtenerCoincidenciasPerfil(descuento, perfil)}
                    onFavorito={toggleFavorito}
                    onAbrir={setDetalleActivo}
                  />
                ),
              )}
            </div>
          </>
        ) : null}

        {vistaActiva === 'todos' ? (
          <>
            <SectionTitle title="Todos los descuentos" subtitle={`${perfil.ciudad} 📍`} />

            <section className="surface-card">
              <label className="search-box">
                <span>⌕</span>
                <input
                  type="search"
                  value={filtros.busqueda}
                  placeholder="Buscar por comercio, banco..."
                  onChange={(event) =>
                    setFiltros((actual) => ({ ...actual, busqueda: event.target.value }))
                  }
                />
              </label>

              <div className="filter-strip compact">
                <button
                  type="button"
                  className={filtros.dia === 'todos' ? 'chip-button active dark' : 'chip-button'}
                  onClick={() => setFiltros((actual) => ({ ...actual, dia: 'todos' }))}
                >
                  Todos los dias
                </button>
                {DIAS.slice(1).map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    className={filtros.dia === dia ? 'chip-button active' : 'chip-button'}
                    onClick={() => setFiltros((actual) => ({ ...actual, dia }))}
                  >
                    {capitalizar(dia.slice(0, 3))}
                  </button>
                ))}
              </div>

              <div className="filter-strip compact">
                <button
                  type="button"
                  className={
                    filtros.categoria === 'todas' ? 'chip-button active dark' : 'chip-button'
                  }
                  onClick={() => setFiltros((actual) => ({ ...actual, categoria: 'todas' }))}
                >
                  ✨ Todos
                </button>
                {Object.entries(CATEGORIAS).map(([id, categoria]) => (
                  <button
                    key={id}
                    type="button"
                    className={filtros.categoria === id ? 'chip-button active' : 'chip-button'}
                    style={{
                      color: categoria.accent,
                      backgroundColor: categoria.color,
                      borderColor: categoria.border,
                    }}
                    onClick={() => setFiltros((actual) => ({ ...actual, categoria: id }))}
                  >
                    {categoria.emoji} {categoria.label}
                  </button>
                ))}
              </div>
            </section>

            <p className="results-copy">{descuentosFiltrados.length} resultados</p>

            <div className="card-list">
              {descuentosFiltrados.map((descuento) => (
                <DiscountCard
                  key={descuento.id}
                  descuento={descuento}
                  esFavorito={favoritos.includes(descuento.id)}
                  coincidencias={obtenerCoincidenciasPerfil(descuento, perfil)}
                  onFavorito={toggleFavorito}
                  onAbrir={setDetalleActivo}
                />
              ))}
            </div>
          </>
        ) : null}

        {vistaActiva === 'favoritos' ? (
          <>
            <SectionTitle
              title="Tus favoritos"
              subtitle="Guardados para ver rapido cuando quieras"
            />
            {favoritosLista.length > 0 ? (
              <div className="card-list">
                {favoritosLista.map((descuento) => (
                  <DiscountCard
                    key={descuento.id}
                    descuento={descuento}
                    esFavorito
                    coincidencias={obtenerCoincidenciasPerfil(descuento, perfil)}
                    onFavorito={toggleFavorito}
                    onAbrir={setDetalleActivo}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Todavia no guardaste descuentos"
                description="Toca la estrella en una promo para tenerla siempre a mano."
              />
            )}
          </>
        ) : null}

        {vistaActiva === 'alertas' ? (
          <>
            <section className="surface-card">
              <SectionTitle
                title="A que hora queres que te avisemos?"
                subtitle="Configura una alerta simple al celular"
              />

              <div className="alert-time-grid">
                {HORARIOS_ALERTA.map((horario) => (
                  <button
                    key={horario.value}
                    type="button"
                    className={
                      perfil.horaAlerta === horario.value
                        ? 'time-card active'
                        : 'time-card'
                    }
                    onClick={() => actualizarPerfil('horaAlerta', horario.value)}
                  >
                    <span className="time-emoji">{horario.emoji}</span>
                    <strong>{horario.value}</strong>
                    <span>{horario.label}</span>
                  </button>
                ))}
              </div>

              <div className="info-banner">
                🔔 Alerta programada para las <strong>{perfil.horaAlerta}</strong> todos los dias
              </div>

              <div className="info-banner secondary">
                💡 Hay <strong>{sugerenciasPendientes}</strong> sugerencias de la comunidad pendientes
              </div>

              {alertPreview ? (
                <div className="info-banner tertiary">
                  {alertPreview.message}
                  <div className="mini-actions">
                    <button type="button" className="mini-action" onClick={simularSync}>
                      Simular sync
                    </button>
                    <button type="button" className="mini-action" onClick={handleEnablePush}>
                      {pushStatus === 'enabled' ? 'Dispositivo activo' : 'Activar push'}
                    </button>
                    {pushStatus === 'enabled' ? (
                      <button type="button" className="mini-action" onClick={handleTestPush}>
                        Probar push
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="surface-card">
              <SectionTitle
                title="Que descuentos te interesan?"
                subtitle="Selecciona las categorias para recibir alertas"
              />

              <div className="preference-grid">
                {Object.entries(CATEGORIAS).map(([id, categoria]) => (
                  <ToggleCard
                    key={id}
                    active={perfil.categoriasFavoritas.includes(id)}
                    label={categoria.label}
                    emoji={categoria.emoji}
                    color={categoria.color}
                    accent={categoria.accent}
                    border={categoria.border}
                    onClick={() => togglePerfilArray('categoriasFavoritas', id)}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card">
              <SectionTitle
                title="Conoces un descuento?"
                subtitle="Ayuda a la comunidad y sugeri un descuento para revisar"
              />

              <SuggestionForm
                form={sugerenciaForm}
                onChange={setSugerenciaForm}
                onSubmit={handleEnviarSugerencia}
              />
            </section>
          </>
        ) : null}

        {vistaActiva === 'cuenta' ? (
          <>
            {!authUser ? (
              <section className="surface-card auth-card">
                <SectionTitle
                  title="Tu cuenta"
                  subtitle="Crea una cuenta para guardar tu perfil y recibir alertas en todos tus dispositivos"
                />
                <div className="auth-switch">
                  <button
                    type="button"
                    className={authMode === 'login' ? 'chip-button active dark' : 'chip-button'}
                    onClick={() => setAuthMode('login')}
                  >
                    Iniciar sesion
                  </button>
                  <button
                    type="button"
                    className={authMode === 'register' ? 'chip-button active dark' : 'chip-button'}
                    onClick={() => setAuthMode('register')}
                  >
                    Crear cuenta
                  </button>
                </div>

                <form className="suggestion-form" onSubmit={handleAuthSubmit}>
                  {authMode === 'register' ? (
                    <input
                      required
                      placeholder="Tu nombre"
                      value={authForm.nombre}
                      onChange={(event) =>
                        setAuthForm((actual) => ({ ...actual, nombre: event.target.value }))
                      }
                    />
                  ) : null}
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={authForm.email}
                    onChange={(event) =>
                      setAuthForm((actual) => ({ ...actual, email: event.target.value }))
                    }
                  />
                  <input
                    required
                    type="password"
                    placeholder="Password"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm((actual) => ({ ...actual, password: event.target.value }))
                    }
                  />
                  {authMode === 'register' ? (
                    <input
                      placeholder="Ciudad"
                      value={authForm.ciudad}
                      onChange={(event) =>
                        setAuthForm((actual) => ({ ...actual, ciudad: event.target.value }))
                      }
                    />
                  ) : null}
                  <button type="submit" className="primary-cta">
                    {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
                  </button>
                </form>

                <div className="info-banner secondary">
                  Demo listo para probar: <strong>demo@descontar.app</strong> / <strong>demo1234</strong>
                </div>
              </section>
            ) : null}

            <section className="profile-card">
              <div className="profile-avatar">{perfil.nombre.charAt(0)}</div>
              <div className="profile-copy">
                <h2>{perfil.nombre}</h2>
                <p>{perfil.email}</p>
                <span className="premium-pill">
                  {perfil.premium ? '👑 Premium' : 'Plan gratis'}
                </span>
                <span className="account-status">
                  {backendStatus === 'conectado'
                    ? 'Cuenta sincronizada con API local'
                    : 'Cuenta guardada solo en este dispositivo'}
                </span>
              </div>
              {authUser ? (
                <button type="button" className="outline-cta profile-logout" onClick={handleLogout}>
                  Cerrar sesion
                </button>
              ) : null}
            </section>

            <div className="stats-grid">
              <StatCard label="Favoritos" value={favoritos.length} emoji="⭐" />
              <StatCard
                label="Categorias"
                value={perfil.categoriasFavoritas.length}
                emoji="🏷️"
              />
              <StatCard
                label="Alertas"
                value={perfil.notificacionesActivas ? 1 : 0}
                emoji="🔔"
              />
            </div>

            <section className="surface-card">
              <SectionTitle
                title="Mis categorias"
                subtitle="Selecciona las que mas te interesan para ver primero"
              />
              <div className="chip-grid">
                {Object.entries(CATEGORIAS).map(([id, categoria]) => (
                  <SelectablePill
                    key={id}
                    active={perfil.categoriasFavoritas.includes(id)}
                    label={categoria.label}
                    emoji={categoria.emoji}
                    color={categoria.color}
                    accent={categoria.accent}
                    border={categoria.border}
                    onClick={() => togglePerfilArray('categoriasFavoritas', id)}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card">
              <SectionTitle
                title="Mis bancos"
                subtitle="La app prioriza los descuentos que realmente podes usar"
              />
              <div className="chip-grid">
                {BANCOS.map((banco) => (
                  <SelectablePill
                    key={banco}
                    active={perfil.bancos.includes(banco)}
                    label={banco}
                    onClick={() => togglePerfilArray('bancos', banco)}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card">
              <SectionTitle title="Tarjetas" subtitle="Debito, credito o marcas especificas" />
              <div className="chip-grid">
                {TARJETAS.map((tarjeta) => (
                  <SelectablePill
                    key={tarjeta}
                    active={perfil.tarjetas.includes(tarjeta)}
                    label={tarjeta}
                    onClick={() => togglePerfilArray('tarjetas', tarjeta)}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card">
              <SectionTitle
                title="Billeteras y apps"
                subtitle="Mercado Pago, Cuenta DNI, Personal Pay y mas"
              />
              <div className="chip-grid">
                {BILLETERAS.map((billetera) => (
                  <SelectablePill
                    key={billetera}
                    active={perfil.billeteras.includes(billetera)}
                    label={billetera}
                    onClick={() => togglePerfilArray('billeteras', billetera)}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card">
              <SectionTitle title="Clubes y beneficios" subtitle="Club Nacion, Farmacity y mas" />
              <div className="chip-grid">
                {CLUBES.map((club) => (
                  <SelectablePill
                    key={club}
                    active={perfil.clubes.includes(club)}
                    label={club}
                    onClick={() => togglePerfilArray('clubes', club)}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card">
              <SectionTitle
                title="Alerta diaria"
                subtitle="A que hora queres que te recuerde revisar los descuentos?"
              />
              <div className="chip-grid">
                {['07:00', '08:00', '09:00', '10:00', '12:00', '18:00', '20:00'].map(
                  (hora) => (
                    <SelectablePill
                      key={hora}
                      active={perfil.horaAlerta === hora}
                      label={hora}
                      onClick={() => actualizarPerfil('horaAlerta', hora)}
                    />
                  ),
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      {detalleActivo ? (
        <DetailModal
          descuento={detalleActivo}
          esFavorito={favoritos.includes(detalleActivo.id)}
          coincidencias={obtenerCoincidenciasPerfil(detalleActivo, perfil)}
          onFavorito={toggleFavorito}
          onClose={() => setDetalleActivo(null)}
        />
      ) : null}

      <nav className="bottom-tabs" aria-label="Navegacion principal">
        {VISTAS.map((vista) => (
          <button
            key={vista.id}
            type="button"
            className={vistaActiva === vista.id ? 'tab-button active' : 'tab-button'}
            onClick={() => setVistaActiva(vista.id)}
          >
            <span className="tab-icon">{vista.icon}</span>
            <span>{vista.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

function DiscountCard({
  descuento,
  esFavorito,
  coincidencias,
  onFavorito,
  onAbrir,
}) {
  const categoria = CATEGORIAS[descuento.categoria] || CATEGORIAS.otro

  return (
    <article
      className="discount-card"
      style={{ borderColor: categoria.border, boxShadow: `inset 0 4px 0 ${categoria.accent}` }}
    >
      <div className="discount-main">
        <div
          className="discount-icon"
          style={{ backgroundColor: categoria.color, color: categoria.accent }}
        >
          {categoria.emoji}
        </div>

        <div className="discount-copy">
          <div className="discount-head">
            <div>
              <h3>{descuento.titulo}</h3>
              <p>{descuento.comercio}</p>
              <strong style={{ color: categoria.accent }}>{descuento.bancoBilletera}</strong>
            </div>

            <div className="discount-badge" style={{ backgroundColor: categoria.accent }}>
              <span>{descuento.porcentaje}%</span>
              <small>OFF</small>
            </div>
          </div>

          {descuento.sponsored ? (
            <div className="sponsor-row">
              <span className="sponsor-pill">Patrocinado</span>
              {descuento.sponsorName ? <span className="sponsor-name">{descuento.sponsorName}</span> : null}
            </div>
          ) : null}

          <div className="meta-row">
            <span
              className="meta-pill"
              style={{ color: categoria.accent, backgroundColor: categoria.color }}
            >
              {categoria.emoji} {categoria.label}
            </span>
            {descuento.diasValidos.length < 7 ? (
              <span className="meta-pill">🗓 {formatearDias(descuento.diasValidos)}</span>
            ) : null}
            <span className="meta-pill">◔ {descuento.horario}</span>
          </div>

          {coincidencias.length > 0 ? (
            <div className="match-row">
              {coincidencias.map((coincidencia) => (
                <span key={coincidencia} className="match-pill">
                  Para vos: {coincidencia}
                </span>
              ))}
            </div>
          ) : null}

          <button type="button" className="link-button" onClick={() => onAbrir(descuento)}>
            Ver detalle
          </button>
        </div>
      </div>

      <button
        type="button"
        className={esFavorito ? 'favorite-button active' : 'favorite-button'}
        onClick={() => onFavorito(descuento.id)}
        aria-label="Agregar o quitar de favoritos"
      >
        ☆
      </button>
    </article>
  )
}

function ToggleCard({ active, label, emoji, color, accent, border, onClick }) {
  return (
    <button
      type="button"
      className={active ? 'toggle-card active' : 'toggle-card'}
      style={{
        backgroundColor: active ? color : '#f5f7fb',
        color: accent,
        borderColor: active ? border : '#d8e0ef',
      }}
      onClick={onClick}
    >
      <span>{emoji}</span>
      <strong>{label}</strong>
      <small>{active ? '✓' : ''}</small>
    </button>
  )
}

function SelectablePill({
  active,
  label,
  emoji,
  color = '#f5f7fb',
  accent = '#5b6b8c',
  border = '#d8e0ef',
  onClick,
}) {
  return (
    <button
      type="button"
      className={active ? 'select-pill active' : 'select-pill'}
      style={{
        color: active ? accent : '#60708f',
        backgroundColor: active ? color : '#f5f7fb',
        borderColor: active ? border : '#d8e0ef',
      }}
      onClick={onClick}
    >
      {emoji ? `${emoji} ` : ''}
      {label}
    </button>
  )
}

function SuggestionForm({ form, onChange, onSubmit }) {
  return (
    <form className="suggestion-form" onSubmit={onSubmit}>
      <input
        required
        placeholder="Nombre del comercio o lugar *"
        value={form.nombreLugar}
        onChange={(event) =>
          onChange((actual) => ({ ...actual, nombreLugar: event.target.value }))
        }
      />
      <input
        placeholder="Tipo de descuento (banco, billetera, promo...)"
        value={form.tipoDescuento}
        onChange={(event) =>
          onChange((actual) => ({ ...actual, tipoDescuento: event.target.value }))
        }
      />
      <textarea
        required
        rows="4"
        placeholder="Descripcion del descuento (% off, condiciones, horarios) *"
        value={form.descripcion}
        onChange={(event) =>
          onChange((actual) => ({ ...actual, descripcion: event.target.value }))
        }
      />
      <input
        placeholder="Tu nombre (opcional)"
        value={form.nombreQuienSugiere}
        onChange={(event) =>
          onChange((actual) => ({ ...actual, nombreQuienSugiere: event.target.value }))
        }
      />
      <button type="submit" className="primary-cta">
        ✈ Enviar sugerencia
      </button>
    </form>
  )
}

function DetailModal({ descuento, esFavorito, coincidencias, onFavorito, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${descuento.titulo}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="close-button" onClick={onClose}>
          Cerrar
        </button>
        <h3>{descuento.titulo}</h3>
        <p className="modal-subtitle">{descuento.comercio}</p>

        <div className="detail-grid">
          <InfoItem label="Beneficio" value={`${descuento.porcentaje}% OFF`} />
          <InfoItem label="Tope" value={descuento.tope} />
          <InfoItem label="Horario" value={descuento.horario} />
          <InfoItem label="Dias" value={formatearDias(descuento.diasValidos)} />
          <InfoItem label="Medio de pago" value={descuento.bancoBilletera} />
          <InfoItem label="Direccion" value={descuento.direccion} />
        </div>

        {coincidencias.length > 0 ? (
          <div className="match-row">
            {coincidencias.map((coincidencia) => (
              <span key={coincidencia} className="match-pill">
                Coincide con tu cuenta: {coincidencia}
              </span>
            ))}
          </div>
        ) : null}

        <p className="modal-description">{descuento.descripcion}</p>

        <div className="modal-actions">
          <button type="button" className="primary-cta secondary" onClick={() => onFavorito(descuento.id)}>
            {esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          </button>
          <a href={descuento.link} target="_blank" rel="noreferrer" className="outline-cta">
            Ver referencia
          </a>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatCard({ label, value, emoji }) {
  return (
    <article className="stat-card">
      <span>{emoji}</span>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  )
}

function EmptyState({ title, description }) {
  return (
    <section className="surface-card empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  )
}

function formatearDias(dias) {
  return dias.map((dia) => capitalizar(dia.slice(0, 3))).join(' · ')
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export default App
