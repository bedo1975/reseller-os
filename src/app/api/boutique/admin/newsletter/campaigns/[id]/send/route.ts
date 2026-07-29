import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/boutique/admin/newsletter/campaigns/[id]/send
 * Admin — sends a newsletter campaign immediately to all active subscribers.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params

    const campaign = await db.newsletterCampaign.findUnique({ where: { id } })
    if (!campaign) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }
    if (campaign.status === 'sent') {
      return NextResponse.json({ error: 'Cette campagne a déjà été envoyée' }, { status: 400 })
    }

    // Get all active subscribers
    const subscribers = await db.newsletterSubscriber.findMany({
      where: { active: true },
    })

    if (subscribers.length === 0) {
      return NextResponse.json({ error: 'Aucun abonné actif' }, { status: 400 })
    }

    // Mark campaign as sending
    await db.newsletterCampaign.update({
      where: { id },
      data: {
        status: 'sending',
        recipientsCount: subscribers.length,
      },
    })

    // Get boutique settings for site name
    const settings = await getBoutiqueSettings()
    const siteName = settings.logoText || 'Boutique'
    const origin = settings.shareSiteUrl || ''
    const unsubscribeUrl = origin ? `${origin}/boutique/newsletter/unsubscribe` : ''

    // Build the full HTML email (wrap campaign content in a template)
    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <table style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background:${campaign.htmlContent.includes('background:') ? 'transparent' : '#007bff'};color:#ffffff;padding:20px 32px;text-align:center;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">${siteName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        ${campaign.htmlContent}
      </td>
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

    // Plain text fallback
    const plainText = `${campaign.subject}\n\nVous recevez cet email car vous êtes inscrit à la newsletter de ${siteName}.\n${unsubscribeUrl ? `Se désinscrire: ${unsubscribeUrl}` : ''}`

    // Send emails one by one (with a small delay to avoid SMTP overload)
    let sentCount = 0
    let failCount = 0

    for (const sub of subscribers) {
      try {
        // Replace {EMAIL} placeholder with the actual email for unsubscribe link
        const personalizedHtml = fullHtml.replace(/\{EMAIL\}/g, encodeURIComponent(sub.email))
        const personalizedText = plainText + (unsubscribeUrl ? `?email=${encodeURIComponent(sub.email)}` : '')

        const sent = await sendEmail({
          to: sub.email,
          subject: campaign.subject,
          text: personalizedText,
          html: personalizedHtml,
        })

        if (sent) {
          sentCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }

      // Small delay between emails (50ms) to be gentle on the SMTP server
      await new Promise(r => setTimeout(r, 50))
    }

    // Mark campaign as sent
    await db.newsletterCampaign.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount,
        failCount,
      },
    })

    return NextResponse.json({
      ok: true,
      sentCount,
      failCount,
      total: subscribers.length,
    })
  } catch (error) {
    console.error('POST /api/boutique/admin/newsletter/campaigns/[id]/send error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
