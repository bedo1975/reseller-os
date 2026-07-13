import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  vintedFetch,
  buildCatalogUrl,
} from '@/lib/vinted'

/**
 * Endpoint called by the cron job (or manually).
 * Scans all enabled saved searches that are due (lastScannedAt + intervalHours < now).
 * For each due search:
 *   1. Fetch latest items from Vinted catalog API (1 page, sorted newest_first)
 *   2. Compare item IDs against the seenItemIds set
 *   3. New IDs → create VintedAlert entries + increment pendingAlerts
 *   4. Update seenItemIds (capped at 500 to avoid unbounded growth)
 *
 * Auth: protected by CRON_SECRET to prevent external abuse.
 */

const MAX_NEW_ALERTS_PER_SCAN = 5   // cap to avoid spamming
const MAX_SEEN_IDS = 500            // sliding window of known IDs

interface SearchParams {
  query?: string
  order?: string
  priceFrom?: string
  priceTo?: string
  statusIds?: number[]
  sizeIds?: number[]
  brandIds?: number[]
  catalogIds?: string[]
  sizeFilter?: string
  maxLikes?: number
  pages?: number
}

function buildParamsFromSaved(sp: SearchParams): Record<string, any> {
  const params: Record<string, any> = {
    per_page: 48, // 1 page is enough for "new items since last scan"
    order: 'newest_first',
  }
  if (sp.query) params.search_text = sp.query
  if (sp.priceFrom) params.price_from = sp.priceFrom
  if (sp.priceTo) params.price_to = sp.priceTo
  if (sp.statusIds?.length) params['status_ids[]'] = sp.statusIds
  if (sp.sizeIds?.length) params['size_ids[]'] = sp.sizeIds
  if (sp.brandIds?.length) params['brand_ids[]'] = sp.brandIds
  if (sp.catalogIds?.length) params['catalog[]'] = sp.catalogIds
  return params
}

export async function POST(req: NextRequest) {
  // Auth: CRON_SECRET (random token from .env)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: Array<{ id: string; name: string; newAlerts: number; error?: string }> = []

  // Check if force mode is requested (manual trigger from admin)
  const forceScan = new URL(req.url).searchParams.get('force') === '1'

  // Find ALL enabled searches — we'll filter for "due" in JS (SQLite can't do date math natively)
  const allEnabledSearches = await db.savedSearch.findMany({
    where: {
      enabled: true,
    },
    include: {
      user: { select: { id: true } },
    },
  })

  // Manual filter for "due" (lastScannedAt + intervalHours < now, or never scanned)
  // In force mode, all enabled searches are considered due
  const trulyDue = forceScan
    ? allEnabledSearches
    : allEnabledSearches.filter((s) => {
        if (!s.lastScannedAt) return true
        const nextDue = new Date(s.lastScannedAt.getTime() + s.intervalHours * 3600 * 1000)
        return nextDue < now
      })

  console.log(`[Vinted scan] ${trulyDue.length} due searches (out of ${allEnabledSearches.length} enabled)${forceScan ? ' [FORCED]' : ''}`)

  if (trulyDue.length === 0) {
    return NextResponse.json({
      scannedAt: now,
      scannedCount: 0,
      results: [],
      message: 'Aucune recherche due. Utilisez ?force=1 pour forcer le scan.',
    })
  }

  for (const search of trulyDue) {
    try {
      const sp: SearchParams = JSON.parse(search.searchParams)
      const catalogParams = buildParamsFromSaved(sp)
      const url = buildCatalogUrl(catalogParams)
      const data = await vintedFetch(url)

      if (data.error || !data.items) {
        results.push({ id: search.id, name: search.name, newAlerts: 0, error: data.error || 'no items' })
        // Still update lastScannedAt so we don't retry immediately
        await db.savedSearch.update({
          where: { id: search.id },
          data: { lastScannedAt: now },
        })
        continue
      }

      // Parse seen IDs
      let seenIds: Record<string, number> = {}
      try { seenIds = JSON.parse(search.seenItemIds) } catch {}

      // Apply maxLikes filter (catalog doesn't filter by likes)
      const maxLikes = sp.maxLikes ?? Infinity
      // Apply sizeFilter (text contains)
      const sizeFilter = sp.sizeFilter?.toLowerCase().trim()

      const items = (data.items as any[])
        .filter((item) => (item.favourite_count || 0) <= maxLikes)
        .filter((item) => {
          if (!sizeFilter) return true
          const itemSize = (item.size_title || '').toLowerCase()
          return itemSize.includes(sizeFilter)
        })
        .sort((a, b) => Number(b.id) - Number(a.id)) // newest first

      // Find new items (ID not in seenIds)
      const newItems = items.filter((item) => !seenIds[String(item.id)])

      // Cap new alerts to avoid spamming
      const alertsToCreate = newItems.slice(0, MAX_NEW_ALERTS_PER_SCAN)

      // Update seenIds (cap at MAX_SEEN_IDS — keep the newest)
      const allIds = items.map((i) => String(i.id)).slice(0, MAX_SEEN_IDS)
      const newSeenIds: Record<string, number> = {}
      allIds.forEach((id) => { newSeenIds[id] = 1 })

      // Create alerts (one per new item)
      if (alertsToCreate.length > 0) {
        await db.vintedAlert.createMany({
          data: alertsToCreate.map((item) => ({
            savedSearchId: search.id,
            itemData: JSON.stringify({
              id: String(item.id),
              title: item.title || '',
              price: item.price?.amount != null ? Number(item.price.amount) : null,
              currency: item.price?.currency_code || null,
              url: item.url || '',
              image: item.photo?.url || null,
              condition: item.status || null,
              likes: item.favourite_count || 0,
              views: item.view_count || 0,
              brand: item.brand_title || null,
              size: item.size_title || null,
              seller: { username: item.user?.login || null },
            }),
            vintedItemId: String(item.id),
          })),
        })
      }

      await db.savedSearch.update({
        where: { id: search.id },
        data: {
          lastScannedAt: now,
          seenItemIds: JSON.stringify(newSeenIds),
          pendingAlerts: { increment: alertsToCreate.length },
        },
      })

      results.push({ id: search.id, name: search.name, newAlerts: alertsToCreate.length })
      console.log(`[Vinted scan] "${search.name}": ${alertsToCreate.length} new alerts (${newItems.length} new items found, ${items.length} total scanned)`)
    } catch (err: any) {
      console.error(`[Vinted scan] error for "${search.name}":`, err?.message)
      results.push({ id: search.id, name: search.name, newAlerts: 0, error: err?.message })
    }

    // Polite delay between searches (avoid Vinted rate-limit)
    await new Promise((r) => setTimeout(r, 1500))
  }

  return NextResponse.json({
    scannedAt: now,
    scannedCount: trulyDue.length,
    results,
  })
}
