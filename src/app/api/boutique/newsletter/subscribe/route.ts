import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

/**
 * POST /api/boutique/newsletter/subscribe
 * Public — subscribe an email to the newsletter.
 *
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const settings = await getBoutiqueSettings()
    if (!settings.newsletterEnabled) {
      return NextResponse.json({ error: 'La newsletter est désactivée' }, { status: 403 })
    }

    const cleanEmail = email.trim().toLowerCase()

    // Upsert: if the subscriber already exists (even if unsubscribed), reactivate them
    const subscriber = await db.newsletterSubscriber.upsert({
      where: { email: cleanEmail },
      create: {
        email: cleanEmail,
        active: true,
        source: 'boutique',
      },
      update: {
        active: true,  // reactivate if previously unsubscribed
      },
    })

    return NextResponse.json({
      ok: true,
      message: settings.newsletterSuccessMessage || 'Inscription réussie',
      subscriberId: subscriber.id,
    })
  } catch (error) {
    console.error('POST /api/boutique/newsletter/subscribe error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
