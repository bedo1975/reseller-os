import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireAuth()
    // All authenticated users can see all expenses (admin-only module, but staff with access see all)
    const expenses = await db.expense.findMany({
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(expenses)
  } catch (error) {
    console.error('GET /api/expenses error:', error)
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
    const { date, category, label, amount, isRecurring, recurringFreq,
            supplierName, invoiceNumber, orderNumber, paymentMethod } = body
    if (!label || !amount) {
      return NextResponse.json({ error: 'Libellé et montant requis' }, { status: 400 })
    }

    const expense = await db.expense.create({
      data: {
        date: date ? new Date(date) : new Date(),
        category: category || 'autre',
        label,
        amount: parseFloat(amount),
        isRecurring: !!isRecurring,
        recurringFreq: isRecurring ? (recurringFreq || 'monthly') : null,
        supplierName: supplierName || null,
        invoiceNumber: invoiceNumber || null,
        orderNumber: orderNumber || null,
        paymentMethod: paymentMethod || null,
        userId: user.id,
      },
    })

    // Si récurrent, crée les prochaines occurrences pour l'année
    if (isRecurring && recurringFreq) {
      const baseDate = date ? new Date(date) : new Date()
      const occurrences: Date[] = []
      for (let i = 1; i <= 12; i++) {
        const next = new Date(baseDate)
        if (recurringFreq === 'weekly') next.setDate(next.getDate() + 7 * i)
        else if (recurringFreq === 'monthly') next.setMonth(next.getMonth() + i)
        else if (recurringFreq === 'yearly') next.setFullYear(next.getFullYear() + i)
        if (next.getFullYear() <= baseDate.getFullYear() + 1) {
          occurrences.push(next)
        }
      }
      for (const occDate of occurrences) {
        await db.expense.create({
          data: {
            date: occDate,
            category: category || 'autre',
            label,
            amount: parseFloat(amount),
            isRecurring: true,
            recurringFreq,
            userId: user.id,
          },
        })
      }
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error('POST /api/expenses error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
