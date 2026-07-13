import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const yearStr = searchParams.get('year')
    const monthStr = searchParams.get('month')
    // If year/month provided, use them; otherwise default to current month (dashboard behavior)
    const now = new Date()
    const currentMonth = monthStr ? parseInt(monthStr) - 1 : now.getMonth()
    const currentYear = yearStr ? parseInt(yearStr) : now.getFullYear()

    const [stockItems, sales, expenses, suppliers, taxSettings] = await Promise.all([
      db.stockItem.findMany({ where: { userId: user.id }, include: { supplier: true, sale: true } }),
      db.sale.findMany({ where: { userId: user.id }, include: { stockItem: true } }),
      db.expense.findMany({ where: { userId: user.id } }),
      db.supplier.findMany({ where: { userId: user.id }, include: { stockItems: { include: { sale: true } } } }),
      db.taxSettings.findUnique({ where: { userId: user.id } }),
    ])

    const taxRate = taxSettings?.taxRate || 0

    const monthlySales = sales.filter(s => {
      const d = new Date(s.saleDate)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    const ca = monthlySales.reduce((sum, s) => sum + s.salePrice, 0)
    const purchases = monthlySales.reduce((sum, s) => sum + s.stockItem.purchaseCost, 0)
    const platformFees = monthlySales.reduce((sum, s) => sum + s.platformFees, 0)
    const monthlyExpenses = expenses
      .filter(e => {
        const d = new Date(e.date)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((sum, e) => sum + e.amount, 0)

    // Cotisations URSSAF = CA × taux
    const urssafCotisation = ca * taxRate / 100

    const profit = monthlySales.reduce((sum, s) => sum + s.profit, 0) - monthlyExpenses - urssafCotisation
    const margin = ca > 0 ? (profit / ca) * 100 : 0

    const roiValues = monthlySales.map(s => (s.profit / s.stockItem.purchaseCost) * 100)
    const avgRoi = roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0

    const statusCounts = stockItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const stockValue = stockItems
      .filter(i => i.status !== 'VENDU')
      .reduce((sum, i) => sum + i.purchaseCost, 0)

    const caByPlatform = monthlySales.reduce((acc, s) => {
      acc[s.platform] = (acc[s.platform] || 0) + s.salePrice
      return acc
    }, {} as Record<string, number>)

    const brandStats: Record<string, { profit: number; count: number; sales: number }> = {}
    sales.forEach(s => {
      const brand = s.stockItem.brand
      if (!brandStats[brand]) brandStats[brand] = { profit: 0, count: 0, sales: 0 }
      brandStats[brand].profit += s.profit
      brandStats[brand].count += 1
      brandStats[brand].sales += s.salePrice
    })
    const topBrands = Object.entries(brandStats)
      .map(([brand, stats]) => ({ brand, ...stats, avgProfit: stats.profit / stats.count }))
      .sort((a, b) => b.profit - a.profit)

    const monthlyEvolution: { month: string; ca: number; profit: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      const monthSales = sales.filter(s => {
        const sd = new Date(s.saleDate)
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear()
      })
      const monthExpenses = expenses
        .filter(e => {
          const ed = new Date(e.date)
          return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear()
        })
        .reduce((sum, e) => sum + e.amount, 0)
      monthlyEvolution.push({
        month: d.toLocaleDateString('fr-FR', { month: 'short' }),
        ca: parseFloat(monthSales.reduce((s, x) => s + x.salePrice, 0).toFixed(2)),
        profit: parseFloat((monthSales.reduce((s, x) => s + x.profit, 0) - monthExpenses).toFixed(2)),
      })
    }

    return NextResponse.json({
      ca: parseFloat(ca.toFixed(2)),
      purchases: parseFloat(purchases.toFixed(2)),
      platformFees: parseFloat(platformFees.toFixed(2)),
      expenses: parseFloat(monthlyExpenses.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      margin: parseFloat(margin.toFixed(1)),
      avgRoi: parseFloat(avgRoi.toFixed(1)),
      salesCount: monthlySales.length,
      totalStockItems: stockItems.length,
      stockValue: parseFloat(stockValue.toFixed(2)),
      statusCounts,
      caByPlatform,
      topBrands,
      monthlyEvolution,
      supplierStats: suppliers.map(s => {
        const itemsSold = s.stockItems.filter(i => i.sale).length
        const totalSpent = s.stockItems.reduce((sum, i) => sum + i.purchaseCost, 0)
        const totalRevenue = s.stockItems.reduce((sum, i) => sum + (i.sale?.salePrice || 0), 0)
        const totalProfit = s.stockItems.reduce((sum, i) => sum + (i.sale?.profit || 0), 0)
        return {
          id: s.id,
          name: s.name,
          type: s.type,
          contact: s.contact,
          phone: s.phone,
          email: s.email,
          address: s.address,
          notes: s.notes,
          itemsCount: s.stockItems.length,
          itemsSold,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalProfit: parseFloat(totalProfit.toFixed(2)),
          roi: totalSpent > 0 ? parseFloat(((totalProfit / totalSpent) * 100).toFixed(1)) : 0,
        }
      }),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
