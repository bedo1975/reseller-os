import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

/**
 * POST /api/boutique/client/forgot-password
 * Public — sends a password reset email if the email exists.
 *
 * Body: { email: string }
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

    // Send email
    const settings = await getBoutiqueSettings()
    const siteUrl = settings.shareSiteUrl || ''
    const resetUrl = siteUrl ? `${siteUrl}/boutique/reinitialiser-mot-de-passe?token=${token}` : ''

    const text = `Bonjour ${client.firstName},\n\nVous avez demandé à réinitialiser votre mot de passe.\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n${resetUrl}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nÀ bientôt !`

    const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;background:#f3f4f6;padding:20px;margin:0;">
<table style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#007bff;color:#fff;padding:20px 24px;text-align:center;">
<h1 style="margin:0;font-size:20px;font-weight:600;">Réinitialisation de votre mot de passe</h1>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 12px 0;">Bonjour ${client.firstName},</p>
<p style="margin:0 0 12px 0;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
${resetUrl ? `<div style="text-align:center;margin:20px 0;"><a href="${resetUrl}" style="display:inline-block;background:#007bff;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Réinitialiser mon mot de passe →</a></div>` : ''}
<p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;">⏰ Ce lien expirera dans 1 heure.</p>
<p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.</p>
<p style="margin-top:20px;font-size:12px;color:#9ca3af;">À bientôt sur ${settings.logoText || 'notre boutique'} !</p>
</td></tr>
</table>
</body></html>`

    await sendEmail({
      to: cleanEmail,
      subject: 'Réinitialisation de votre mot de passe',
      text,
      html,
    })

    return NextResponse.json({ ok: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' })
  } catch (error) {
    console.error('POST /api/boutique/client/forgot-password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
