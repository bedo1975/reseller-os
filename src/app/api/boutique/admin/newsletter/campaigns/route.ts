import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list all campaigns
export async function GET() {
  try {
    await requireAuth()
    const campaigns = await db.newsletterCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('GET /api/boutique/admin/newsletter/campaigns error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — create a new campaign
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { name, subject, htmlContent, scheduledAt } = body

    if (!name || !subject || !htmlContent) {
      return NextResponse.json({ error: 'Nom, sujet et contenu HTML requis' }, { status: 400 })
    }

    const status = scheduledAt ? 'scheduled' : 'draft'

    const campaign = await db.newsletterCampaign.create({
      data: {
        name: name.trim(),
        subject: subject.trim(),
        htmlContent,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    })

    return NextResponse.json(campaign)
  } catch (error) {
    console.error('POST /api/boutique/admin/newsletter/campaigns error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
