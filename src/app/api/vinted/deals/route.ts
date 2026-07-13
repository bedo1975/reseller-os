import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import {
  vintedFetch,
  buildCatalogUrl,
  type VintedItem,
} from '@/lib/vinted'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)

    const query = searchParams.get('query') || ''
    const maxLikes = parseInt(searchParams.get('max_likes') || '3') || 3
    const pages = Math.min(parseInt(searchParams.get('pages') || '5') || 5, 20)
    const perPage = 96
    const sizeFilter = searchParams.get('size') || undefined
    const priceFrom = searchParams.get('price_from')
    const priceTo = searchParams.get('price_to')

    const catalogParams: Record<string, any> = {
      search_text: query,
      per_page: perPage,
      order: 'newest_first',
    }
    if (priceFrom) catalogParams.price_from = priceFrom
    if (priceTo) catalogParams.price_to = priceTo

    // New: support for brand_ids[], size_ids[], catalog[], status_ids[]
    const brandIdsParam = searchParams.get('brand_ids')
    if (brandIdsParam) {
      const ids = brandIdsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      if (ids.length) catalogParams['brand_ids[]'] = ids
    }
    const sizeIdsParam = searchParams.get('size_ids')
    if (sizeIdsParam) {
      const ids = sizeIdsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      if (ids.length) catalogParams['size_ids[]'] = ids
    }
    const catalogIdsParam = searchParams.get('catalog_ids')
    if (catalogIdsParam) {
      const ids = catalogIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      if (ids.length) catalogParams['catalog[]'] = ids
    }
    const statusIdsParam = searchParams.get('status_ids')
    if (statusIdsParam) {
      const ids = statusIdsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      if (ids.length) catalogParams['status_ids[]'] = ids
    }

    const allItems: any[] = []
    for (let p = 1; p <= pages; p++) {
      const data = await vintedFetch(
        buildCatalogUrl({ ...catalogParams, page: p }),
      )
      if (data.error) break
      allItems.push(...(data.items || []))
    }

    // Filter: max likes + price range (catalog-level, fast)
    const minNum = priceFrom ? parseFloat(priceFrom) : null
    const maxNum = priceTo ? parseFloat(priceTo) : null

    // Deduplicate by ID (Vinted can return the same item on multiple pages)
    const seenIds = new Set<string | number>()
    const filtered = allItems.filter((item) => {
      if (!item.id || seenIds.has(item.id)) return false
      const likes = item.favourite_count || 0
      if (likes > maxLikes) return false
      const price = item.price?.amount != null ? Number(item.price.amount) : null
      if (minNum !== null && (price === null || price < minNum)) return false
      if (maxNum !== null && (price === null || price > maxNum)) return false
      seenIds.add(item.id)
      return true
    })
    filtered.sort((a, b) => (a.id || 0) - (b.id || 0))

    // Build response items (no creation date — Vinted catalog API doesn't expose it)
    const items: VintedItem[] = filtered.map((item) => ({
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
      createdAt: null,
      createdAtRaw: null,
    }))

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('GET /api/vinted/deals error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}



