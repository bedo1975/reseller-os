import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { vintedFetch } from '@/lib/vinted'

// In-memory cache (10 min) keyed by keyword — brand list rarely changes
const cache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 10 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const keyword = (searchParams.get('keyword') || '').trim()
    if (!keyword || keyword.length < 2) {
      return NextResponse.json({ brands: [] })
    }

    const cacheKey = keyword.toLowerCase()
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    const DOMAIN = process.env.VINTED_DOMAIN || 'https://www.vinted.fr'
    const url = `${DOMAIN}/api/v2/brands?keyword=${encodeURIComponent(keyword)}&per_page=10`
    const data = await vintedFetch(url)

    if (!data || data.error) {
      return NextResponse.json({ brands: [] })
    }
    if (data.code || data.message_code) {
      // Vinted error (rate limit, etc.) — return empty gracefully
      return NextResponse.json({ brands: [], rateLimited: true })
    }

    const brands = (data.brands || []).map((b: any) => ({
      id: b.id,
      title: b.title,
    }))

    const result = { brands }
    cache.set(cacheKey, { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/vinted/brands error:', error)
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
