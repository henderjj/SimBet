// Offline support. Hashed build assets are immutable so they're served
// cache-first; the page shell and the odds feed are network-first so a new
// deploy or fresh odds always win when there's a connection.
const CACHE = 'simbet-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const shell = await fetch('./', { cache: 'no-cache' })
      const html = await shell.clone().text()
      await cache.put('./', shell)
      // Precache whatever the shell references, so the first visit already works offline.
      const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((url) => !/^[a-z]+:/i.test(url))
      await Promise.allSettled(assets.map((url) => cache.add(url)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (hit) return hit
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  event.respondWith(url.pathname.includes('/assets/') ? cacheFirst(request) : networkFirst(request))
})
