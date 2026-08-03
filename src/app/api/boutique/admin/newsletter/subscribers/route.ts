import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list all newsletter subscribers
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all'  // all | active | inactive

    const where: any = {}
    if (search) {
      where.email = { contains: search }
    }
    if (filter === 'active') where.active = true
    if (filter === 'inactive') where.active = false

    const subscribers = await db.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const totalCount = await db.newsletterSubscriber.count()
    const activeCount = await db.newsletterSubscriber.count({ where: { active: true } })

    return NextResponse.json({
      subscribers,
      stats: { total: totalCount, active: activeCount },
    })
  } catch (error) {
    console.error('GET /api/boutique/admin/newsletter/subscribers error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — manually add a subscriber
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const subscriber = await db.newsletterSubscriber.upsert({
      where: { email: cleanEmail },
      create: { email: cleanEmail, active: true, source: 'admin' },
      update: { active: true },
    })

    return NextResponse.json(subscriber)
  } catch (error) {
    console.error('POST /api/boutique/admin/newsletter/subscribers error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
