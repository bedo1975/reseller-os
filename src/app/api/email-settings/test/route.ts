import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

// POST — send a test email to the admin's address using current SMTP settings
export async function POST() {
  try {
    const user = await requireAdmin()

    // Get the admin user's email (the recipient of the test)
    const adminUser = await db.user.findUnique({ where: { id: user.id } })
    if (!adminUser?.email) {
      return NextResponse.json(
        { error: 'Aucun email associé à votre compte administrateur' },
        { status: 400 },
      )
    }

    // Check that SMTP is configured
    const settings = await db.emailSettings.findUnique({ where: { userId: user.id } })
    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
      return NextResponse.json(
        { error: 'SMTP non configuré. Renseignez hôte, utilisateur et mot de passe, puis sauvegardez.' },
        { status: 400 },
      )
    }

    // Try to send the test email
    const sent = await sendEmail({
      to: adminUser.email,
      subject: '[DBoxPro] Email de test',
      text: `Bonjour,\n\nCeci est un email de test envoyé depuis DBoxPro.\n\nSi vous le recevez, votre configuration SMTP fonctionne correctement.\n\nDétails de la config :\n- Serveur : ${settings.smtpHost}:${settings.smtpPort}\n- Sécurisé (SSL/TLS) : ${settings.smtpSecure ? 'Oui' : 'Non'}\n- Utilisateur : ${settings.smtpUser}\n- From : ${settings.fromEmail || settings.smtpUser}\n\nCordialement,\nL'équipe DBoxPro`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #007bff;">Email de test DBoxPro</h2>
          <p>Bonjour,</p>
          <p>Ceci est un email de test envoyé depuis DBoxPro.</p>
          <p>Si vous le recevez, votre configuration SMTP fonctionne correctement.</p>
          <h3 style="margin-top: 24px; color: #333;">Détails de la configuration</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">Serveur</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${settings.smtpHost}:${settings.smtpPort}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">Sécurisé (SSL/TLS)</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${settings.smtpSecure ? 'Oui' : 'Non'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">Utilisateur</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${settings.smtpUser}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 600;">Adresse d'envoi</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${settings.fromEmail || settings.smtpUser}</td></tr>
          </table>
          <p style="margin-top: 24px; color: #666; font-size: 12px;">Cordialement,<br>L'équipe DBoxPro</p>
        </div>
      `,
    })

    if (!sent) {
      return NextResponse.json(
        { error: "Échec de l'envoi. Vérifiez les logs serveur — SMTP injoignable, identifiants invalides, ou adresse From refusée." },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, sentTo: adminUser.email })
  } catch (error: any) {
    console.error('POST /api/email-settings/test error:', error)
    if (error?.message === 'UNAUTHORIZED' || error?.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur lors du test SMTP' },
      { status: 500 },
    )
  }
}
