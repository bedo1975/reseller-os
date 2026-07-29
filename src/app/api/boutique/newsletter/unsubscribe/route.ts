import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/newsletter/unsubscribe
 * Public — unsubscribe an email from the newsletter.
 *
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    await db.newsletterSubscriber.updateMany({
      where: { email: cleanEmail },
      data: { active: false },
    })

    return NextResponse.json({
      ok: true,
      message: 'Vous avez été désinscrit de la newsletter.',
    })
  } catch (error) {
    console.error('POST /api/boutique/newsletter/unsubscribe error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
