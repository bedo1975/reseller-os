import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  vintedFetch,
  buildCatalogUrl,
} from '@/lib/vinted'

/**
 * Cron endpoint: scans all due saved searches and creates alerts for new items.
 * Called by external cron (aaPanel, crontab) every hour.
 *
 * Auth: CRON_SECRET header
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.fr/api/cron/vinted-scan
 *
 * Force mode (scan all enabled searches regardless of interval):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.fr/api/cron/vinted-scan?force=1"
 */

const MAX_NEW_ALERTS_PER_SCAN = 5
const MAX_SEEN_IDS = 500

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
    per_page: 48,
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
  // Auth check
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured in .env' },
      { status: 500 },
    )
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const forceScan = new URL(req.url).searchParams.get('force') === '1'
  const results: Array<{ id: string; name: string; newAlerts: number; error?: string }> = []

  // Find ALL enabled searches
  const allEnabledSearches = await db.savedSearch.findMany({
    where: { enabled: true },
    include: { user: { select: { id: true } } },
  })

  // Filter for "due" in JS (SQLite can't do date math natively)
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
        await db.savedSearch.update({
          where: { id: search.id },
          data: { lastScannedAt: now },
        })
        continue
      }

      // Parse seen IDs
      let seenIds: Record<string, number> = {}
      try { seenIds = JSON.parse(search.seenItemIds) } catch {}

      // Apply maxLikes + sizeFilter (catalog doesn't filter by these)
      const maxLikes = sp.maxLikes ?? Infinity
      const sizeFilter = sp.sizeFilter?.toLowerCase().trim()

      const items = (data.items as any[])
        .filter((item) => (item.favourite_count || 0) <= maxLikes)
        .filter((item) => {
          if (!sizeFilter) return true
          const itemSize = (item.size_title || '').toLowerCase()
          return itemSize.includes(sizeFilter)
        })
        .sort((a, b) => Number(b.id) - Number(a.id))

      // Find new items (ID not in seenIds)
      const newItems = items.filter((item) => !seenIds[String(item.id)])
      const alertsToCreate = newItems.slice(0, MAX_NEW_ALERTS_PER_SCAN)

      // Update seenIds (sliding window)
      const allIds = items.map((i) => String(i.id)).slice(0, MAX_SEEN_IDS)
      const newSeenIds: Record<string, number> = {}
      allIds.forEach((id) => { newSeenIds[id] = 1 })

      // Create alerts
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
      console.log(`[Vinted scan] "${search.name}": ${alertsToCreate.length} new alerts (${newItems.length} new items, ${items.length} total)`)

      // Polite delay between searches (avoid Vinted rate-limit)
      await new Promise((r) => setTimeout(r, 1500))
    } catch (err: any) {
      console.error(`[Vinted scan] error for "${search.name}":`, err?.message)
      results.push({ id: search.id, name: search.name, newAlerts: 0, error: err?.message })
    }
  }

  return NextResponse.json({
    scannedAt: now,
    scannedCount: trulyDue.length,
    results,
  })
}
