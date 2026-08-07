'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * TrackingScript — invisible component that tracks page views on the boutique.
 * Placed in the boutique layout to track every page.
 *
 * Generates a unique visitorId (stored in localStorage) on first visit.
 * Sends a POST to /api/boutique/track on every page navigation.
 */
export function TrackingScript() {
  const pathname = usePathname()

  useEffect(() => {
    // Only track boutique pages
    if (!pathname.startsWith('/')) return

    // ── Get or create visitor ID ──
    let visitorId = localStorage.getItem('boutique_visitor_id')
    let isFirstVisit = false
    if (!visitorId) {
      visitorId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('boutique_visitor_id', visitorId)
      isFirstVisit = true
    }

    // ── Determine page type ──
    let pageType = 'other'
    let productSku: string | undefined
    let category: string | undefined

    if (pathname === '/') {
      pageType = 'home'
    } else if (pathname.startsWith('/produit/')) {
      pageType = 'product'
      productSku = decodeURIComponent(pathname.split('/produit/')[1]?.split('?')[0] || '')
    } else if (pathname.startsWith('/categorie/')) {
      pageType = 'category'
      category = decodeURIComponent(pathname.split('/categorie/')[1]?.split('?')[0] || '')
    } else if (pathname.startsWith('/checkout')) {
      pageType = 'checkout'
    }

    // ── Track page view ──
    const trackData = {
      visitorId,
      path: pathname,
      pageType,
      productSku,
      category,
      isFirstVisit,
      referrer: document.referrer || undefined,
    }

    fetch('/api/boutique/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackData),
    }).catch(() => {}) // silent fail

    // ── Track duration on page unload ──
    const startTime = Date.now()
    const handleUnload = () => {
      const duration = Math.round((Date.now() - startTime) / 1000)
      if (duration > 0) {
        navigator.sendBeacon('/api/boutique/track', JSON.stringify({
          ...trackData,
          duration,
          isFirstVisit: false,
        }))
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [pathname])

  return null // invisible component
}
