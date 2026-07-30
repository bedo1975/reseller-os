import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * GET /api/admin/stats?period=30d
 * Auth required — returns aggregated statistics.
 *
 * Periods: 7d | 30d | 90d | 12m | all
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30d'

    // Compute date filter
    const now = new Date()
    let dateFilter: Date
    switch (period) {
      case '7d': dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case '90d': dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
      case '12m': dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break
      case 'all': dateFilter = new Date(0); break
      default: dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // ── Visitors ──
    const visitors = await db.visitorTracking.findMany({
      where: { createdAt: { gte: dateFilter } },
      select: {
        id: true, visitorId: true, ipAddress: true,
        country: true, city: true, region: true,
        referrerSource: true, referrerDomain: true,
        device: true, browser: true, os: true, isFirstVisit: true, createdAt: true,
        userAgent: true, language: true,
      },
    })

    const totalVisitors = visitors.length
    const uniqueVisitors = new Set(visitors.map(v => v.visitorId)).size
    const newVisitors = visitors.filter(v => v.isFirstVisit).length

    // By country
    const byCountry: Record<string, number> = {}
    const byCity: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    const byDevice: Record<string, number> = {}
    const byBrowser: Record<string, number> = {}
    const byOS: Record<string, number> = {}
    const byDay: Record<string, number> = {}

    for (const v of visitors) {
      const c = v.country || 'Inconnu'
      byCountry[c] = (byCountry[c] || 0) + 1
      const cityKey = v.city ? `${v.city}, ${c}` : c
      byCity[cityKey] = (byCity[cityKey] || 0) + 1
      const s = v.referrerSource || 'direct'
      bySource[s] = (bySource[s] || 0) + 1
      const d = v.device || 'unknown'
      byDevice[d] = (byDevice[d] || 0) + 1
      const b = v.browser || 'unknown'
      byBrowser[b] = (byBrowser[b] || 0) + 1
      const o = v.os || 'unknown'
      byOS[o] = (byOS[o] || 0) + 1
      const day = new Date(v.createdAt).toISOString().slice(0, 10)
      byDay[day] = (byDay[day] || 0) + 1
    }

    // Recent visitors with full details (for the visitor list)
    const recentVisitors = visitors
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
      .map(v => ({
        id: v.id,
        ipAddress: v.ipAddress || '—',
        country: v.country || 'Inconnu',
        city: v.city || '—',
        region: v.region || null,
        device: v.device || 'unknown',
        browser: v.browser || 'unknown',
        os: v.os || 'unknown',
        referrerSource: v.referrerSource || 'direct',
        referrerDomain: v.referrerDomain || null,
        language: v.language || null,
        isFirstVisit: v.isFirstVisit,
        createdAt: v.createdAt,
      }))

    // ── Page Views ──
    const pageViews = await db.pageView.findMany({
      where: { createdAt: { gte: dateFilter } },
      select: { path: true, pageType: true, productSku: true, createdAt: true },
    })

    const totalPageViews = pageViews.length

    // Top pages
    const byPage: Record<string, number> = {}
    for (const pv of pageViews) {
      byPage[pv.path] = (byPage[pv.path] || 0) + 1
    }
    const topPages = Object.entries(byPage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, count]) => ({ path, count }))

    // Top products
    const productViews = pageViews.filter(pv => pv.pageType === 'product' && pv.productSku)
    const byProduct: Record<string, number> = {}
    for (const pv of productViews) {
      if (pv.productSku) byProduct[pv.productSku] = (byProduct[pv.productSku] || 0) + 1
    }
    const topProducts = Object.entries(byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sku, views]) => ({ sku, views }))

    // Fetch product details for top products
    if (topProducts.length > 0) {
      const items = await db.stockItem.findMany({
        where: { sku: { in: topProducts.map(p => p.sku) } },
        select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true },
      })
      const itemMap = new Map(items.map(i => [i.sku, i]))
      for (const p of topProducts) {
        const item = itemMap.get(p.sku)
        if (item) {
          (p as any).brand = item.brand
          ;(p as any).title = item.title
          ;(p as any).category = item.category
          ;(p as any).price = item.suggestedPrice
          try {
            const photos = JSON.parse(item.photos)
            ;(p as any).photo = photos[0] ? (photos[0].startsWith('/uploads/') ? `/api${photos[0]}` : photos[0]) : null
          } catch { (p as any).photo = null }
        }
      }
    }

    // ── Reviews ──
    const reviews = await db.productReview.findMany({
      where: { active: true },
      select: { id: true, productSku: true, authorName: true, rating: true, title: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const totalReviews = reviews.length
    const avgRating = totalReviews > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews : 0

    // Reviews by rating
    const reviewsByRating: Record<number, number> = {}
    for (const r of reviews) reviewsByRating[r.rating] = (reviewsByRating[r.rating] || 0) + 1

    // Reviews by product
    const reviewsByProduct: Record<string, { count: number; avgRating: number; total: number }> = {}
    for (const r of reviews) {
      if (!reviewsByProduct[r.productSku]) reviewsByProduct[r.productSku] = { count: 0, avgRating: 0, total: 0 }
      reviewsByProduct[r.productSku].count++
      reviewsByProduct[r.productSku].total += r.rating
    }
    for (const sku in reviewsByProduct) {
      reviewsByProduct[sku].avgRating = reviewsByProduct[sku].total / reviewsByProduct[sku].count
    }

    // Fetch product details for reviews
    const reviewSkus = Object.keys(reviewsByProduct)
    if (reviewSkus.length > 0) {
      const items = await db.stockItem.findMany({
        where: { sku: { in: reviewSkus } },
        select: { sku: true, brand: true, title: true, category: true },
      })
      const itemMap = new Map(items.map(i => [i.sku, i]))
      for (const sku in reviewsByProduct) {
        const item = itemMap.get(sku)
        if (item) {
          ;(reviewsByProduct[sku] as any).brand = item.brand
          ;(reviewsByProduct[sku] as any).title = item.title
          ;(reviewsByProduct[sku] as any).category = item.category
        }
      }
    }

    // ── Sales stats (from Sales) ──
    const sales = await db.sale.findMany({
      where: { saleDate: { gte: dateFilter } },
      select: { salePrice: true, shippingCost: true, profit: true, saleDate: true, platform: true },
    })

    const totalRevenue = sales.reduce((s, x) => s + x.salePrice + (x.shippingCost || 0), 0)
    const totalProfit = sales.reduce((s, x) => s + x.profit, 0)
    const salesByDay: Record<string, { revenue: number; profit: number; count: number }> = {}
    for (const s of sales) {
      const day = new Date(s.saleDate).toISOString().slice(0, 10)
      if (!salesByDay[day]) salesByDay[day] = { revenue: 0, profit: 0, count: 0 }
      salesByDay[day].revenue += s.salePrice + (s.shippingCost || 0)
      salesByDay[day].profit += s.profit
      salesByDay[day].count++
    }

    // ── Format daily chart data ──
    const dailyChart = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, visitors: count, sales: salesByDay[date]?.count || 0, revenue: salesByDay[date]?.revenue || 0 }))

    return NextResponse.json({
      period,
      summary: {
        totalVisitors,
        newVisitors,
        totalPageViews,
        avgPageViewsPerVisitor: totalVisitors > 0 ? parseFloat((totalPageViews / totalVisitors).toFixed(1)) : 0,
        totalSales: sales.length,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        totalReviews,
        avgRating: parseFloat(avgRating.toFixed(1)),
      },
      visitorsByCountry: Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 15),
      visitorsByCity: Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 15),
      visitorsBySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]),
      visitorsByDevice: Object.entries(byDevice).sort((a, b) => b[1] - a[1]),
      visitorsByBrowser: Object.entries(byBrowser).sort((a, b) => b[1] - a[1]),
      visitorsByOS: Object.entries(byOS).sort((a, b) => b[1] - a[1]),
      topPages,
      topProducts,
      dailyChart,
      recentVisitors,
      reviews: {
        total: totalReviews,
        avgRating: parseFloat(avgRating.toFixed(1)),
        byRating: Object.entries(reviewsByRating).sort((a, b) => parseInt(b[0]) - parseInt(a[0])),
        byProduct: Object.entries(reviewsByProduct)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([sku, data]) => ({ sku, ...data })),
        recent: reviews.slice(0, 20).map(r => ({
          id: r.id,
          productSku: r.productSku,
          authorName: r.authorName,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/admin/stats error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
