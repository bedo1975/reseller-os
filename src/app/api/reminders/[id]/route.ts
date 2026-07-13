import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

// Calcule la prochaine échéance en fonction de la fréquence
function computeNextDue(frequency: string, intervalNum: number, from: Date = new Date()): Date {
  const next = new Date(from)
  switch (frequency) {
    case 'daily': next.setDate(next.getDate() + intervalNum); break
    case 'weekly': next.setDate(next.getDate() + 7 * intervalNum); break
    case 'monthly': next.setMonth(next.getMonth() + intervalNum); break
    case 'quarterly': next.setMonth(next.getMonth() + 3 * intervalNum); break
    case 'yearly': next.setFullYear(next.getFullYear() + intervalNum); break
    default: next.setMonth(next.getMonth() + intervalNum)
  }
  return next
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    const existing = await db.reminder.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Rappel introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowed = ['title', 'description', 'category', 'frequency', 'intervalNum']
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }

    // Actions spéciales
    if (body.action === 'done') {
      // Marquer comme fait → met à jour lastDone, recalcule nextDue, reset dismissed
      updateData.lastDone = new Date()
      updateData.dismissed = false
      const freq = body.frequency || existing.frequency
      const interval = body.intervalNum || existing.intervalNum
      updateData.nextDue = computeNextDue(freq, interval, new Date())
    }

    if (body.action === 'dismiss') {
      // Fermer le popup sans action → dismissed = true
      updateData.dismissed = true
    }

    if (body.action === 'reset') {
      // Réafficher un rappel dismissé
      updateData.dismissed = false
    }

    // Si la fréquence ou l'intervalle change, recalculer nextDue
    if (('frequency' in updateData || 'intervalNum' in updateData) && !('nextDue' in updateData)) {
      const freq = (updateData.frequency as string) || existing.frequency
      const interval = (updateData.intervalNum as number) || existing.intervalNum
      updateData.nextDue = computeNextDue(freq, interval, existing.lastDone || new Date())
    }

    const reminder = await db.reminder.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(reminder)
  } catch (error) {
    console.error('PATCH /api/reminders/[id] error:', error)
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

    const existing = await db.reminder.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Rappel introuvable' }, { status: 404 })
    }

    await db.reminder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reminders/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
