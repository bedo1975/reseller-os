import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireAuth()
    const suppliers = await db.supplier.findMany({
      where: { userId: user.id },
      include: { stockItems: { include: { sales: { orderBy: { saleDate: 'desc' } } } } },
      orderBy: { createdAt: 'desc' },
    })

    const result = suppliers.map(s => {
      const itemsSold = s.stockItems.filter(i => i.sales && i.sales.length > 0).length
      const totalSpent = s.stockItems.reduce((sum, i) => sum + i.purchaseCost, 0)
      const totalRevenue = s.stockItems.reduce((sum, i) => sum + (i.sales?.reduce((ss, sl) => ss + sl.salePrice, 0) || 0), 0)
      const totalProfit = s.stockItems.reduce((sum, i) => sum + (i.sales?.reduce((ss, sl) => ss + sl.profit, 0) || 0), 0)
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        siret: s.siret,
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
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/suppliers error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { name, type, siret, contact, phone, email, address, notes } = body
    if (!name || !type) {
      return NextResponse.json({ error: 'Nom et type requis' }, { status: 400 })
    }
    const supplier = await db.supplier.create({
      data: { name, type, siret: siret || null, contact, phone, email, address, notes, userId: user.id },
    })
    return NextResponse.json(supplier)
  } catch (error) {
    console.error('POST /api/suppliers error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
