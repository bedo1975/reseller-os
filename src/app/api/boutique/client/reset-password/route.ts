import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { sendEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'

/**
 * POST /api/boutique/client/reset-password
 * Public — resets the password using a valid token.
 *
 * Body: { token: string, password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
    }

    // Find the client by token
    const client = await db.boutiqueClient.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré' }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update the client
    await db.boutiqueClient.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    // Send confirmation email
    const settings = await getBoutiqueSettings()
    const siteUrl = settings.shareSiteUrl || ''

    const text = `Bonjour ${client.firstName},\n\nVotre mot de passe a été modifié avec succès.\n\nVous pouvez maintenant vous connecter avec votre nouveau mot de passe.\n${siteUrl ? siteUrl + '/boutique/connexion' : ''}\n\nÀ bientôt !`

    const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;background:#f3f4f6;padding:20px;margin:0;">
<table style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#10b981;color:#fff;padding:20px 24px;text-align:center;">
<h1 style="margin:0;font-size:20px;font-weight:600;">Mot de passe modifié ✓</h1>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 12px 0;">Bonjour ${client.firstName},</p>
<p style="margin:0 0 12px 0;">Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
${siteUrl ? `<div style="text-align:center;margin:20px 0;"><a href="${siteUrl}/boutique/connexion" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Se connecter →</a></div>` : ''}
<p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;">🔒 Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.</p>
<p style="margin-top:20px;font-size:12px;color:#9ca3af;">À bientôt sur ${settings.logoText || 'notre boutique'} !</p>
</td></tr>
</table>
</body></html>`

    await sendEmail({
      to: client.email,
      subject: 'Votre mot de passe a été modifié',
      text,
      html,
    })

    return NextResponse.json({ ok: true, message: 'Mot de passe modifié avec succès' })
  } catch (error) {
    console.error('POST /api/boutique/client/reset-password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
