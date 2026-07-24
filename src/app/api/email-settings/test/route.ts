import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

// POST — send a test email to the admin's address using current SMTP settings
export async function POST() {
  try {
    const user = await requireAdmin()

    const adminUser = await db.user.findUnique({ where: { id: user.id } })
    if (!adminUser?.email) {
      return NextResponse.json(
        { error: 'Aucun email associé à votre compte administrateur' },
        { status: 400 },
      )
    }

    const settings = await db.emailSettings.findUnique({ where: { userId: user.id } })
    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
      return NextResponse.json(
        { error: 'SMTP non configuré. Renseignez hôte, utilisateur et mot de passe, puis sauvegardez.' },
        { status: 400 },
      )
    }

    // Get the email design from BoutiqueSettings
    const boutiqueSettings = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })
    const design = boutiqueSettings?.emailDesign || 'modern'
    const shopName = boutiqueSettings?.logoText || 'Votre Boutique'

    // Build test email HTML based on the selected design
    let html: string

    if (design === 'classic') {
      html = `
        <table style="width:100%;max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;border:1px solid #ddd;">
          <tr><td style="background:#0a3d62;color:#fff;padding:16px;text-align:center;font-size:20px;font-weight:bold;">${shopName}</td></tr>
          <tr><td style="padding:24px;color:#333;">
            <h2 style="margin:0 0 12px 0;font-size:18px;">Email de test</h2>
            <p style="margin:0 0 12px 0;">Bonjour,</p>
            <p style="margin:0 0 12px 0;">Ceci est un email de test envoyé depuis votre boutique (design <strong>Classique</strong>).</p>
            <p style="margin:0 0 12px 0;">Si vous le recevez, votre configuration SMTP fonctionne correctement.</p>
            <p style="margin:0 0 0 0;font-size:13px;color:#666;">Serveur : ${settings.smtpHost}:${settings.smtpPort} · Sécurisé : ${settings.smtpSecure ? 'Oui' : 'Non'} · Utilisateur : ${settings.smtpUser}</p>
          </td></tr>
          <tr><td style="background:#f5f5f5;padding:12px;text-align:center;font-size:11px;color:#999;">© ${new Date().getFullYear()} ${shopName}. Tous droits réservés.</td></tr>
        </table>
      `
    } else if (design === 'minimal') {
      html = `
        <div style="max-width:480px;margin:0 auto;font-family:Georgia,serif;padding:40px 20px;text-align:center;">
          <h1 style="font-size:22px;font-weight:normal;color:#222;margin:0 0 24px 0;">${shopName}</h1>
          <p style="font-size:15px;line-height:1.8;color:#555;margin:0 0 16px 0;">Ceci est un email de test envoyé depuis votre boutique (design <em>Minimaliste</em>).</p>
          <p style="font-size:15px;line-height:1.8;color:#555;margin:0 0 16px 0;">Si vous le recevez, votre configuration SMTP fonctionne correctement.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
          <p style="font-size:12px;color:#aaa;margin:0;">© ${new Date().getFullYear()} ${shopName}</p>
        </div>
      `
    } else {
      // modern (default)
      html = `
        <div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#007bff 0%,#0056b3 100%);padding:28px 24px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${shopName}</h1>
          </div>
          <div style="padding:28px 24px;text-align:center;background:#fff;">
            <h2 style="margin:0 0 12px 0;font-size:18px;color:#212529;">Email de test ✉️</h2>
            <p style="font-size:15px;line-height:1.6;color:#495057;margin:0 0 12px 0;">Ceci est un email de test envoyé depuis votre boutique (design <strong>Moderne</strong>).</p>
            <p style="font-size:15px;line-height:1.6;color:#495057;margin:0 0 16px 0;">Si vous le recevez, votre configuration SMTP fonctionne correctement.</p>
            <div style="display:inline-block;background:#e7f1ff;color:#007bff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:600;margin-top:8px;">
              ${settings.smtpHost}:${settings.smtpPort} · ${settings.smtpSecure ? 'SSL/TLS' : 'STARTTLS'}
            </div>
          </div>
          <div style="background:#f8f9fa;padding:16px 24px;text-align:center;font-size:12px;color:#6c757d;">
            © ${new Date().getFullYear()} ${shopName}. Tous droits réservés.
          </div>
        </div>
      `
    }

    const sent = await sendEmail({
      to: adminUser.email,
      subject: `[Test] Email de test — Design ${design}`,
      text: 'Ceci est un email de test. Si vous le recevez, votre configuration SMTP fonctionne correctement.',
      html,
    })

    if (!sent) {
      return NextResponse.json(
        { error: "Échec de l'envoi. Vérifiez les logs serveur — SMTP injoignable, identifiants invalides, ou adresse From refusée." },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, sentTo: adminUser.email, design })
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
