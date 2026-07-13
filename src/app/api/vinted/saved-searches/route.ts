import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireAuth()

    const searches = await db.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        alerts: {
          where: { read: false },
          select: { id: true },
        },
      },
    })

    return NextResponse.json({
      searches: searches.map((s) => ({
        id: s.id,
        name: s.name,
        searchParams: JSON.parse(s.searchParams),
        intervalHours: s.intervalHours,
        lastScannedAt: s.lastScannedAt,
        enabled: s.enabled,
        pendingAlerts: s.pendingAlerts,
        unreadAlerts: s.alerts.length,
        createdAt: s.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/vinted/saved-searches error:', error)
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

    const { name, searchParams, intervalHours } = body as {
      name: string
      searchParams: any
      intervalHours?: number
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }
    if (!searchParams || typeof searchParams !== 'object') {
      return NextResponse.json({ error: 'Paramètres de recherche requis' }, { status: 400 })
    }

    // Clamp intervalHours between 1 and 168 (1 hour to 1 week)
    const interval = Math.min(Math.max(parseInt(String(intervalHours || 6)) || 6, 1), 168)

    const saved = await db.savedSearch.create({
      data: {
        userId: user.id,
        name: name.trim(),
        searchParams: JSON.stringify(searchParams),
        intervalHours: interval,
      },
    })

    return NextResponse.json({
      id: saved.id,
      name: saved.name,
      searchParams: JSON.parse(saved.searchParams),
      intervalHours: saved.intervalHours,
      lastScannedAt: saved.lastScannedAt,
      enabled: saved.enabled,
      pendingAlerts: saved.pendingAlerts,
    })
  } catch (error) {
    console.error('POST /api/vinted/saved-searches error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
