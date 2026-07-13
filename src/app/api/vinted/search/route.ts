import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import {
  vintedFetch,
  buildCatalogUrl,
  formatItems,
} from '@/lib/vinted'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)

    const query = searchParams.get('query') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '48') || 48, 96)
    const order = searchParams.get('order') || 'newest_first'
    const minLikes = searchParams.get('min_likes') !== null ? parseInt(searchParams.get('min_likes')!) : undefined
    const maxLikes = searchParams.get('max_likes') !== null ? parseInt(searchParams.get('max_likes')!) : undefined
    const sizeFilter = searchParams.get('size') || undefined

    const params: Record<string, any> = {
      search_text: query,
      page,
      per_page: perPage,
      order,
    }

    const priceFrom = searchParams.get('price_from')
    const priceTo = searchParams.get('price_to')
    // catalog_ids (categories) — comma-separated, becomes catalog[] (array param)
    const catalogIdsParam = searchParams.get('catalog_ids')
    // brand_ids — comma-separated, becomes brand_ids[] (array param)
    const brandIdsParam = searchParams.get('brand_ids')
    // size_ids — comma-separated, becomes size_ids[] (array param)
    const sizeIdsParam = searchParams.get('size_ids')
    const statusIdsParam = searchParams.get('status_ids')
    const conditionParam = searchParams.get('condition')

    if (priceFrom) params.price_from = priceFrom
    if (priceTo) params.price_to = priceTo

    // Categories (catalog[]) — Vinted expects this as a repeated array param
    if (catalogIdsParam) {
      const ids = catalogIdsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (ids.length) params['catalog[]'] = ids
    }

    // Brands (brand_ids[])
    if (brandIdsParam) {
      const ids = brandIdsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
      if (ids.length) params['brand_ids[]'] = ids
    }

    // Sizes (size_ids[]) — clothing sizes and shoe sizes use the same param
    if (sizeIdsParam) {
      const ids = sizeIdsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
      if (ids.length) params['size_ids[]'] = ids
    }

    if (statusIdsParam) {
      const ids = statusIdsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
      if (ids.length) {
        params['status_ids[]'] = ids
      }
    } else if (conditionParam) {
      const { STATUS_MAP } = await import('@/lib/vinted')
      const ids = conditionParam
        .split(',')
        .map((k) => STATUS_MAP[k.trim().toLowerCase().replace(/\s+/g, '_')])
        .filter(Boolean)
      if (ids.length) {
        params['status_ids[]'] = ids
      }
    }

    const data = await vintedFetch(buildCatalogUrl(params))
    if (data.error) {
      return NextResponse.json({
        error: data.error,
        items: [],
        total: 0,
        page,
        per_page: perPage,
      })
    }

    // Catalog-level filtering + sort by ID descending (Vinted IDs are sequential — higher = more recent)
    let items = formatItems(data.items, { minLikes, maxLikes, sizeFilter })
    items.sort((a, b) => Number(b.id) - Number(a.id))

    return NextResponse.json({
      items,
      total: items.length,
      page,
      per_page: perPage,
    })
  } catch (error) {
    console.error('GET /api/vinted/search error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}


