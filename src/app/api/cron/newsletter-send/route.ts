import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { sendEmail } from '@/lib/email'

/**
 * GET /api/cron/newsletter-send
 * Cron endpoint — called periodically (every 5-15 min) to send scheduled campaigns.
 *
 * Can be called by:
 * - A cron job (curl https://junashop.fr/api/cron/newsletter-send)
 * - Vercel Cron (add to vercel.json)
 * - PM2 cron
 * - External service like cron-job.org
 *
 * No auth required (the endpoint is safe — it only sends campaigns that are due).
 */

export async function GET() {
  try {
    const now = new Date()

    // Find scheduled campaigns that are due
    const dueCampaigns = await db.newsletterCampaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
    })

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ ok: true, message: 'Aucune campagne à envoyer', sent: 0 })
    }

    const settings = await getBoutiqueSettings()
    const siteName = settings.logoText || 'Boutique'
    const origin = settings.shareSiteUrl || ''
    const unsubscribeUrl = origin ? `${origin}/boutique/newsletter/unsubscribe` : ''

    let totalSent = 0

    for (const campaign of dueCampaigns) {
      // Get active subscribers
      const subscribers = await db.newsletterSubscriber.findMany({
        where: { active: true },
      })

      if (subscribers.length === 0) {
        // No subscribers — mark as sent anyway to avoid retrying
        await db.newsletterCampaign.update({
          where: { id: campaign.id },
          data: { status: 'sent', sentAt: now, recipientsCount: 0 },
        })
        continue
      }

      // Mark as sending
      await db.newsletterCampaign.update({
        where: { id: campaign.id },
        data: { status: 'sending', recipientsCount: subscribers.length },
      })

      // Build email
      const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <table style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background:#007bff;color:#ffffff;padding:20px 32px;text-align:center;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">${siteName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">${campaign.htmlContent}</td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
          Vous recevez cet email car vous êtes inscrit à la newsletter de ${siteName}.
          ${unsubscribeUrl ? `<br><a href="${unsubscribeUrl}?email=\{EMAIL\}" style="color:#6b7280;text-decoration:underline;">Se désinscrire</a>` : ''}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

      const plainText = `${campaign.subject}\n\n${siteName} Newsletter\n${unsubscribeUrl ? `Se désinscrire: ${unsubscribeUrl}` : ''}`

      let sentCount = 0
      let failCount = 0

      for (const sub of subscribers) {
        try {
          const personalizedHtml = fullHtml.replace(/\{EMAIL\}/g, encodeURIComponent(sub.email))
          const sent = await sendEmail({
            to: sub.email,
            subject: campaign.subject,
            text: plainText,
            html: personalizedHtml,
          })
          if (sent) sentCount++
          else failCount++
        } catch {
          failCount++
        }
        await new Promise(r => setTimeout(r, 50))
      }

      // Mark as sent
      await db.newsletterCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          sentCount,
          failCount,
        },
      })

      totalSent++
    }

    return NextResponse.json({
      ok: true,
      message: `${totalSent} campagne(s) envoyée(s)`,
      sent: totalSent,
    })
  } catch (error) {
    console.error('GET /api/cron/newsletter-send error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
