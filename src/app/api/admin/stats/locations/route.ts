import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * GET /api/admin/stats/locations?period=30d&country=France
 * Returns the list of available countries and cities for the stats filters.
 *
 * If `country` is provided, returns the cities available for that country only.
 * Otherwise, returns all countries and all cities (with their country).
 *
 * Used by the Statistics module's filter dropdowns.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'
    const countryFilter = searchParams.get('country')?.trim() || null

    // Compute date filter (same logic as /api/admin/stats)
    const now = new Date()
    let dateFilter: Date
    switch (period) {
      case '7d': dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case '90d': dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
      case '12m': dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break
      case 'all': dateFilter = new Date(0); break
      default: dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Fetch all visitors for the period (with country filter if provided).
    // We need the full list to aggregate by country and city.
    const where: any = { createdAt: { gte: dateFilter } }
    if (countryFilter) {
      where.country = { contains: countryFilter }
    }

    const visitors = await db.visitorTracking.findMany({
      where,
      select: { country: true, city: true },
    })

    // Aggregate countries
    const countryMap = new Map<string, number>()
    const cityMap = new Map<string, { city: string; country: string; count: number }>()

    for (const v of visitors) {
      const country = v.country || 'Inconnu'
      countryMap.set(country, (countryMap.get(country) || 0) + 1)

      // City key includes the country for display purposes (city can be ambiguous across countries)
      if (v.city) {
        const cityKey = `${v.city}|${country}`
        const existing = cityMap.get(cityKey)
        if (existing) {
          existing.count++
        } else {
          cityMap.set(cityKey, { city: v.city, country, count: 1 })
        }
      }
    }

    // Sort by count descending
    const countries = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)

    const cities = Array.from(cityMap.values())
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      countries,
      cities,
    })
  } catch (error) {
    console.error('GET /api/admin/stats/locations error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
