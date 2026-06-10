self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}

  event.waitUntil(
    self.registration.showNotification(payload.title || 'DescontAR', {
      body: payload.body || 'Hay descuentos nuevos para vos.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: {
        url: payload.url || '/',
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client)

      if (existing) {
        existing.focus()
        existing.navigate(event.notification.data?.url || '/')
        return
      }

      return self.clients.openWindow(event.notification.data?.url || '/')
    }),
  )
})
