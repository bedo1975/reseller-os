import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

// GET — Liste tous les rappels + ceux qui sont dus
export async function GET() {
  try {
    const user = await requireAuth()
    const reminders = await db.reminder.findMany({
      where: { userId: user.id },
      orderBy: { nextDue: 'asc' },
    })

    const now = new Date()
    const dueReminders = reminders.filter(r => r.nextDue <= now && !r.dismissed)

    return NextResponse.json({ reminders, dueReminders, hasDue: dueReminders.length > 0 })
  } catch (error) {
    console.error('GET /api/reminders error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — Crée un nouveau rappel
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { title, description, category, frequency, intervalNum, startDate } = body

    if (!title) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
    }

    const freq = frequency || 'monthly'
    const interval = parseInt(intervalNum) || 1
    const start = startDate ? new Date(startDate) : new Date()

    // Calcule la première échéance
    let nextDue = new Date(start)
    switch (freq) {
      case 'daily': nextDue.setDate(nextDue.getDate() + interval); break
      case 'weekly': nextDue.setDate(nextDue.getDate() + 7 * interval); break
      case 'monthly': nextDue.setMonth(nextDue.getMonth() + interval); break
      case 'quarterly': nextDue.setMonth(nextDue.getMonth() + 3 * interval); break
      case 'yearly': nextDue.setFullYear(nextDue.getFullYear() + interval); break
    }

    const reminder = await db.reminder.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category || 'general',
        frequency: freq,
        intervalNum: interval,
        nextDue,
      },
    })

    return NextResponse.json(reminder)
  } catch (error) {
    console.error('POST /api/reminders error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
