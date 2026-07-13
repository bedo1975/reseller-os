import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireAuth()
    const purchases = await db.purchase.findMany({
      where: { userId: user.id },
      include: { supplier: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(purchases)
  } catch (error) {
    console.error('GET /api/purchases error:', error)
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
    const { date, designation, category, supplierId, supplierName, amount, invoiceNumber, paymentMethod, notes } = body

    if (!designation || !amount) {
      return NextResponse.json({ error: 'Désignation et montant requis' }, { status: 400 })
    }

    const purchase = await db.purchase.create({
      data: {
        date: date ? new Date(date) : new Date(),
        designation: designation.trim(),
        category: category || 'fourniture',
        supplierId: supplierId || null,
        supplierName: supplierName || null,
        amount: parseFloat(amount),
        invoiceNumber: invoiceNumber || null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        userId: user.id,
      },
      include: { supplier: true },
    })

    return NextResponse.json(purchase)
  } catch (error) {
    console.error('POST /api/purchases error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
