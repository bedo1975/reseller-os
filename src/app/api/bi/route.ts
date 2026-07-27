import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireAuth()
    const sales = await db.sale.findMany({
      where: { userId: user.id },
      include: { stockItem: true },
    })
    const stockItems = await db.stockItem.findMany({
      where: { userId: user.id },
      include: { sales: { orderBy: { saleDate: 'desc' } } },
    })

    // 1. Marques les plus rentables
    const brandProfit: Record<string, { profit: number; count: number; sales: number; cost: number }> = {}
    sales.forEach(s => {
      const b = s.stockItem.brand
      if (!brandProfit[b]) brandProfit[b] = { profit: 0, count: 0, sales: 0, cost: 0 }
      brandProfit[b].profit += s.profit
      brandProfit[b].count += 1
      brandProfit[b].sales += s.salePrice
      brandProfit[b].cost += s.stockItem.purchaseCost
    })
    const topBrandsByProfit = Object.entries(brandProfit)
      .map(([brand, v]) => ({
        brand,
        profit: parseFloat(v.profit.toFixed(2)),
        sales: parseFloat(v.sales.toFixed(2)),
        count: v.count,
        avgProfit: parseFloat((v.profit / v.count).toFixed(2)),
        roi: v.cost > 0 ? parseFloat(((v.profit / v.cost) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.profit - a.profit)

    // 2. Catégories les plus rentables
    const categoryStats: Record<string, { profit: number; count: number; sales: number }> = {}
    sales.forEach(s => {
      const c = s.stockItem.category
      if (!categoryStats[c]) categoryStats[c] = { profit: 0, count: 0, sales: 0 }
      categoryStats[c].profit += s.profit
      categoryStats[c].count += 1
      categoryStats[c].sales += s.salePrice
    })
    const topCategories = Object.entries(categoryStats)
      .map(([category, v]) => ({
        category,
        profit: parseFloat(v.profit.toFixed(2)),
        sales: parseFloat(v.sales.toFixed(2)),
        count: v.count,
        margin: v.sales > 0 ? parseFloat(((v.profit / v.sales) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.profit - a.profit)

    // 3. Temps moyen de vente par marque (jours entre achat et vente)
    const brandSellTime: Record<string, { totalTime: number; count: number }> = {}
    sales.forEach(s => {
      const days = Math.floor(
        (new Date(s.saleDate).getTime() - new Date(s.stockItem.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      const b = s.stockItem.brand
      if (!brandSellTime[b]) brandSellTime[b] = { totalTime: 0, count: 0 }
      brandSellTime[b].totalTime += days
      brandSellTime[b].count += 1
    })
    const sellTimeByBrand = Object.entries(brandSellTime)
      .map(([brand, v]) => ({
        brand,
        avgDays: parseFloat((v.totalTime / v.count).toFixed(1)),
        count: v.count,
      }))
      .sort((a, b) => a.avgDays - b.avgDays)

    // 4. CA par plateforme
    const platformStats: Record<string, { sales: number; profit: number; count: number; fees: number }> = {}
    sales.forEach(s => {
      const p = s.platform
      if (!platformStats[p]) platformStats[p] = { sales: 0, profit: 0, count: 0, fees: 0 }
      platformStats[p].sales += s.salePrice
      platformStats[p].profit += s.profit
      platformStats[p].count += 1
      platformStats[p].fees += s.platformFees
    })
    const caByPlatform = Object.entries(platformStats)
      .map(([platform, v]) => ({
        platform,
        sales: parseFloat(v.sales.toFixed(2)),
        profit: parseFloat(v.profit.toFixed(2)),
        fees: parseFloat(v.fees.toFixed(2)),
        count: v.count,
        margin: v.sales > 0 ? parseFloat(((v.profit / v.sales) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.sales - a.sales)

    // 5. État du stock par marque
    const stockByBrand: Record<string, { total: number; sold: number; available: number; value: number }> = {}
    stockItems.forEach(i => {
      const b = i.brand
      if (!stockByBrand[b]) stockByBrand[b] = { total: 0, sold: 0, available: 0, value: 0 }
      stockByBrand[b].total += 1
      if (i.status === 'VENDU') stockByBrand[b].sold += 1
      else {
        stockByBrand[b].available += 1
        stockByBrand[b].value += i.purchaseCost
      }
    })
    const stockBrandSummary = Object.entries(stockByBrand)
      .map(([brand, v]) => ({ brand, ...v, value: parseFloat(v.value.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      topBrandsByProfit,
      topCategories,
      sellTimeByBrand,
      caByPlatform,
      stockBrandSummary,
    })
  } catch (error) {
    console.error('GET /api/bi error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
