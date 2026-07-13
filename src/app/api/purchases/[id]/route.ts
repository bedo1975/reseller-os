import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    const existing = await db.purchase.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
    }

    const allowed = ['date', 'designation', 'category', 'supplierId', 'supplierName', 'amount', 'invoiceNumber', 'paymentMethod', 'notes']
    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }
    if ('amount' in updateData) updateData.amount = parseFloat(updateData.amount as string)
    if ('date' in updateData) updateData.date = new Date(updateData.date as string)
    if ('supplierId' in updateData && !updateData.supplierId) updateData.supplierId = null

    const purchase = await db.purchase.update({
      where: { id },
      data: updateData,
      include: { supplier: true },
    })

    return NextResponse.json(purchase)
  } catch (error) {
    console.error('PATCH /api/purchases/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.purchase.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
    }

    await db.purchase.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/purchases/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
