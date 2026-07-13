import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// POST /api/accounting/reset
// Supprime toutes les ventes, achats hors stock, dépenses et remet les articles en "Publié"
// ADMIN ONLY
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { scope } = body // 'all' | 'sales' | 'purchases' | 'expenses'

    const results: Record<string, number> = {}

    if (scope === 'all' || scope === 'sales') {
      // Supprime les ventes et remet les articles en PUBLIE
      const sales = await db.sale.findMany({ select: { id: true, stockItemId: true } })
      results.sales = sales.length
      await db.sale.deleteMany()
      // Remet les articles vendus en PUBLIE
      await db.stockItem.updateMany({
        where: { status: 'VENDU' },
        data: { status: 'PUBLIE', platform: null, platforms: '[]' },
      })
    }

    if (scope === 'all' || scope === 'purchases') {
      // Supprime les achats hors stock
      const purchases = await db.purchase.count()
      results.purchases = purchases
      await db.purchase.deleteMany()
    }

    if (scope === 'all' || scope === 'expenses') {
      // Supprime les dépenses
      const expenses = await db.expense.count()
      results.expenses = expenses
      await db.expense.deleteMany()
    }

    return NextResponse.json({
      success: true,
      message: `Données supprimées : ${Object.entries(results).map(([k, v]) => `${v} ${k}`).join(', ')}`,
      results,
    })
  } catch (error) {
    console.error('POST /api/accounting/reset error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
