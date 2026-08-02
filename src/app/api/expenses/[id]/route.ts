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

    const existing = await db.expense.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }

    const allowed = ['date', 'category', 'label', 'amount', 'isRecurring', 'recurringFreq',
                     'supplierName', 'invoiceNumber', 'orderNumber', 'paymentMethod',
                     'invoicePath', 'invoiceName']
    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }
    if ('amount' in updateData) {
      const a = updateData.amount
      if (a === '' || a === null || a === undefined) updateData.amount = 0
      else { const p = parseFloat(String(a)); updateData.amount = Number.isNaN(p) ? 0 : p }
    }
    if ('date' in updateData) updateData.date = new Date(updateData.date as string)
    if ('isRecurring' in updateData && !updateData.isRecurring) updateData.recurringFreq = null

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error('PATCH /api/expenses/[id] error:', error)
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

    const existing = await db.expense.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }

    // Delete invoice file if any
    if (existing.invoicePath) {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const relativePath = existing.invoicePath.replace('/api/uploads/', '')
        const diskPath = path.join(process.cwd(), 'public', 'uploads', relativePath)
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath)
      } catch (e) {
        console.error('[expense-delete] Failed to delete invoice file:', e)
      }
    }

    await db.expense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/expenses/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
