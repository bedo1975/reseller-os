import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list all collected share emails
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const where: any = {}
    if (search) {
      where.OR = [
        { friendEmail: { contains: search } },
        { senderEmail: { contains: search } },
        { senderName: { contains: search } },
        { productSku: { contains: search } },
        { productBrand: { contains: search } },
      ]
    }

    const referrals = await db.shareReferral.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // Stats
    const totalCount = await db.shareReferral.count()
    const uniqueFriendEmails = await db.shareReferral.groupBy({
      by: ['friendEmail'],
      _count: { _all: true },
    })

    return NextResponse.json({
      referrals,
      stats: {
        total: totalCount,
        uniqueEmails: uniqueFriendEmails.length,
      },
    })
  } catch (error) {
    console.error('GET /api/boutique/admin/share/emails error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — delete a single referral email (by id)
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }
    await db.shareReferral.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/share/emails error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
