import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyPasswordResetRequest } from '@/lib/email'
import crypto from 'crypto'

/**
 * POST /api/boutique/client/forgot-password
 * Public — sends a password reset email if the email exists.
 *
 * Body: { email: string }
 *
 * The email uses the admin's custom `templatePasswordLost` if defined as HTML,
 * otherwise falls back to the same buildEmailTemplate() wrapper used by the
 * other notification emails (notifyNewOrder, notifyOrderStatusChange, …).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    // Find the client — always return success to prevent email enumeration
    const client = await db.boutiqueClient.findUnique({
      where: { email: cleanEmail },
    })

    if (!client) {
      // Don't reveal that the email doesn't exist
      return NextResponse.json({ ok: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' })
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.boutiqueClient.update({
      where: { id: client.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    })

    // Build reset URL
    const settings = await getBoutiqueSettings()
    const siteUrl = settings.shareSiteUrl || ''
    const resetUrl = siteUrl ? `${siteUrl}/reinitialiser-mot-de-passe?token=${token}` : ''

    // Send email using the shared helper (respects admin custom template)
    await notifyPasswordResetRequest(cleanEmail, client.firstName, resetUrl)

    return NextResponse.json({ ok: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' })
  } catch (error) {
    console.error('POST /api/boutique/client/forgot-password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
