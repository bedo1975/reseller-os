import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Admin can edit any purchase; staff only their own
    const existing = await db.purchase.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
    }

    const allowed = ['date', 'designation', 'category', 'supplierId', 'supplierName', 'amount', 'invoiceNumber', 'paymentMethod', 'notes']
    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }
    // Invoice path/name — accept string OR explicit null (to detach)
    if (typeof body.invoicePath === 'string' || body.invoicePath === null) {
      updateData.invoicePath = body.invoicePath || null
    }
    if (typeof body.invoiceName === 'string' || body.invoiceName === null) {
      updateData.invoiceName = body.invoiceName || null
    }
    if ('amount' in updateData) {
      const a = updateData.amount
      if (a === '' || a === null || a === undefined) {
        updateData.amount = 0
      } else {
        const parsed = parseFloat(String(a))
        updateData.amount = Number.isNaN(parsed) ? 0 : parsed
      }
    }
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

    const existing = await db.purchase.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
    }

    // Delete the invoice file from disk (if any)
    if (existing.invoicePath) {
      try {
        const relativePath = existing.invoicePath.replace('/api/uploads/', '')
        const diskPath = path.join(process.cwd(), 'public', 'uploads', relativePath)
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath)
      } catch (e) {
        console.error('[purchase-delete] Failed to delete invoice file:', e)
      }
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
