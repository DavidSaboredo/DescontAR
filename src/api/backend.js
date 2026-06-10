const TOKEN_KEY = 'descontar-auth-token'

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token) {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const token = options.auth === false ? null : getStoredToken()
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || 'No se pudo completar la operacion.')
  }

  return response.json()
}

export function fetchBootstrap() {
  return request('/api/bootstrap', { auth: false })
}

export function login(payload) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  })
}

export function register(payload) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  })
}

export function fetchMe() {
  return request('/api/auth/me')
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
  })
}

export function savePerfil(updates) {
  return request('/api/perfil', {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  })
}

export function toggleFavoritoApi(descuentoId) {
  return request('/api/favoritos/toggle', {
    method: 'POST',
    body: JSON.stringify({ descuentoId }),
  })
}

export function createSugerencia(payload) {
  return request('/api/sugerencias', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchAlertPreview() {
  return request('/api/alertas/preview')
}

export function runSyncPreview() {
  return request('/api/sync/run', {
    method: 'POST',
  })
}

export function fetchPushPublicKey() {
  return request('/api/push/public-key', { auth: false })
}

export function subscribePushDevice(subscription) {
  return request('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription }),
  })
}

export function sendTestPush() {
  return request('/api/push/test', {
    method: 'POST',
  })
}
