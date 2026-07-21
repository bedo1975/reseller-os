'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // UNREGISTER any existing service workers — we no longer use a SW
    // because it was causing stale chunks (Turbopack) to be served after
    // webpack rebuilds. The browser HTTP cache + immutable Next.js chunk
    // filenames handle caching correctly without a SW.
    const unregisterAll = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const reg of registrations) {
          await reg.unregister()
        }
        // Also clear all caches
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch (e) {
        console.warn('[SW] Failed to unregister:', e)
      }
    }

    unregisterAll()
  }, [])
  return null
}
