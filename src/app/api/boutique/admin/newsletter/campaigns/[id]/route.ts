import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// PATCH — update a campaign
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()
    const { name, subject, htmlContent, scheduledAt, status } = body

    const data: any = {}
    if (typeof name === 'string') data.name = name.trim()
    if (typeof subject === 'string') data.subject = subject.trim()
    if (typeof htmlContent === 'string') data.htmlContent = htmlContent
    if (scheduledAt !== undefined) {
      data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null
      // If scheduling, set status to 'scheduled' (unless already sent)
      if (scheduledAt && (!status || status === 'draft')) {
        data.status = 'scheduled'
      }
    }
    if (typeof status === 'string') {
      const ALLOWED = ['draft', 'scheduled', 'sending', 'sent', 'cancelled']
      if (ALLOWED.includes(status)) data.status = status
    }

    const campaign = await db.newsletterCampaign.update({ where: { id }, data })
    return NextResponse.json(campaign)
  } catch (error) {
    console.error('PATCH /api/boutique/admin/newsletter/campaigns/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — delete a campaign
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params
    await db.newsletterCampaign.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/newsletter/campaigns/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
