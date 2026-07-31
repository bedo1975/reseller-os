import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyAccountValidation } from '@/lib/email'
import crypto from 'crypto'

/**
 * POST /api/boutique/client/resend-validation
 * Public — resends the account validation email for an unvalidated account.
 *
 * Body: { email: string }
 *
 * Anti-enumeration: always returns success (even if email doesn't exist or
 * is already validated). The actual email is only sent if the conditions
 * are met.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    // Always return success to prevent email enumeration
    const genericResponse = NextResponse.json({
      ok: true,
      message: 'Si cet email correspond à un compte non validé, un nouvel email de validation a été envoyé.',
    })

    // Find the client
    const client = await db.boutiqueClient.findUnique({
      where: { email: cleanEmail },
    })

    if (!client) {
      return genericResponse
    }

    // If already validated, do nothing (return generic success)
    if (client.emailValidated) {
      return genericResponse
    }

    // Generate a fresh token
    const token = crypto.randomBytes(32).toString('hex')

    await db.boutiqueClient.update({
      where: { id: client.id },
      data: { validationToken: token },
    })

    // Build validation URL + send email
    // The link points to the GET /api/boutique/client/validate-account route
    // which validates directly and redirects to /boutique/connexion?validated=1
    const settings = await getBoutiqueSettings()
    const siteUrl = settings.shareSiteUrl || ''
    const validationUrl = siteUrl
      ? `${siteUrl}/api/boutique/client/validate-account?token=${token}`
      : ''

    await notifyAccountValidation(cleanEmail, client.firstName, validationUrl)

    return genericResponse
  } catch (error) {
    console.error('POST /api/boutique/client/resend-validation error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
