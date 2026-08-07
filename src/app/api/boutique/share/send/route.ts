import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

/**
 * POST /api/boutique/share/send
 * Public — sends a "share with friend" email for a product.
 *
 * Body: {
 *   sku: string,
 *   friendEmail: string,
 *   senderName?: string,
 *   senderEmail?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sku, friendEmail, senderName, senderEmail } = body

    if (!sku || typeof sku !== 'string') {
      return NextResponse.json({ error: 'SKU requis' }, { status: 400 })
    }
    if (!friendEmail || typeof friendEmail !== 'string' || !friendEmail.includes('@')) {
      return NextResponse.json({ error: 'Email ami invalide' }, { status: 400 })
    }

    const settings = await getBoutiqueSettings()
    if (!settings.shareEnabled) {
      return NextResponse.json({ error: 'Le partage est désactivé' }, { status: 403 })
    }

    // Fetch product to build URL + snapshot
    const stockItem = await db.stockItem.findFirst({
      where: { sku },
      select: {
        sku: true,
        brand: true,
        title: true,
        category: true,
        size: true,
        color: true,
        suggestedPrice: true,
        photos: true,
      },
    })
    if (!stockItem) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // Build absolute product URL.
    // Priority: admin-configured shareSiteUrl > x-forwarded-host > host header > origin > referer > req.url
    let origin: string | null = null

    if (settings.shareSiteUrl) {
      // Admin-configured URL (highest priority — guarantees correct domain in emails)
      origin = settings.shareSiteUrl.replace(/\/+$/, '')
    } else {
      // Fallback: try to detect from request headers
      const forwardedHost = req.headers.get('x-forwarded-host')
      const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
      const hostHeader = req.headers.get('host')
      const originHeader = req.headers.get('origin')
      const refererHeader = req.headers.get('referer')

      if (forwardedHost) {
        origin = `${forwardedProto}://${forwardedHost}`
      } else if (hostHeader) {
        origin = `${req.url.startsWith('https') ? 'https' : 'http'}://${hostHeader}`
      } else if (originHeader) {
        origin = originHeader
      } else if (refererHeader) {
        try { origin = new URL(refererHeader).origin } catch { origin = new URL(req.url).origin }
      } else {
        origin = new URL(req.url).origin
      }
    }

    const productUrl = `${origin}/produit/${encodeURIComponent(sku)}`
    const safeOrigin = origin || ''

    // Build absolute photo URL (photos stored as /uploads/... or already absolute URLs)
    let photos: string[] = []
    try { photos = JSON.parse(stockItem.photos) } catch {}
    const firstPhoto = photos[0]
    let mainPhoto: string | null = null
    if (firstPhoto) {
      if (firstPhoto.startsWith('http://') || firstPhoto.startsWith('https://')) {
        // Already absolute URL (e.g. external URL)
        mainPhoto = firstPhoto
      } else if (firstPhoto.startsWith('/uploads/')) {
        // Local upload — prepend origin
        mainPhoto = `${safeOrigin}/api${firstPhoto}`
      } else if (firstPhoto.startsWith('/')) {
        // Other relative path — prepend origin
        mainPhoto = `${safeOrigin}${firstPhoto}`
      } else {
        mainPhoto = firstPhoto
      }
    }

    // Build email content
    const siteName = settings.logoText || 'Boutique'
    const subject = (settings.shareSubject || 'Un ami vous recommande cet article')
      .replace(/\{SITE_NAME\}/g, siteName)
      .replace(/\{URL\}/g, productUrl)
      .replace(/\{BRAND\}/g, stockItem.brand)
      .replace(/\{TITLE\}/g, stockItem.title || stockItem.brand)

    let messageBody = (settings.shareMessage || 'Découvrez cet article : {URL}')
      .replace(/\{SITE_NAME\}/g, siteName)
      .replace(/\{URL\}/g, productUrl)
      .replace(/\{BRAND\}/g, stockItem.brand)
      .replace(/\{TITLE\}/g, stockItem.title || stockItem.brand)

    // Append sender signature if provided
    if (senderName) {
      messageBody += `\n\n— ${senderName}`
      if (senderEmail) messageBody += ` (${senderEmail})`
    }

    // Build HTML version
    const productTitle = stockItem.title || `${stockItem.brand} ${stockItem.category}`
    const priceText = stockItem.suggestedPrice
      ? `<div style="font-size:18px;font-weight:bold;color:#007bff;margin:8px 0 16px;">${parseFloat(stockItem.suggestedPrice.toString()).toFixed(2)} €</div>`
      : ''

    const senderLine = senderName
      ? `<p style="margin-top:20px;font-size:12px;color:#888;">Recommandé par <strong>${escapeHtml(senderName)}</strong>${senderEmail ? ` (${escapeHtml(senderEmail)})` : ''}</p>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;background:#f3f4f6;padding:20px;margin:0;">
  <table style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background:${escapeHtml(settings.shareColor || '#007bff')};color:#ffffff;padding:24px 32px;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">🎁 Un ami vous recommande un article</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">sur ${escapeHtml(siteName)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#374151;">
          ${escapeHtml(messageBody).replace(/\n/g, '<br>')}
        </p>

        <table style="width:100%;background:#f9fafb;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            ${mainPhoto ? `<td style="width:160px;padding:16px;">
              <img src="${escapeHtml(mainPhoto)}" alt="${escapeHtml(productTitle)}" style="width:128px;height:128px;object-fit:cover;border-radius:8px;display:block;box-shadow:0 1px 3px rgba(0,0,0,0.1);" />
            </td>` : ''}
            <td style="padding:16px;vertical-align:middle;">
              <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(stockItem.brand)}</div>
              <div style="font-size:18px;font-weight:600;color:#111827;margin:4px 0;">${escapeHtml(productTitle)}</div>
              ${stockItem.size ? `<div style="font-size:12px;color:#6b7280;">Taille : ${escapeHtml(stockItem.size)}</div>` : ''}
              ${priceText}
            </td>
          </tr>
        </table>

        <a href="${escapeHtml(productUrl)}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:${escapeHtml(settings.shareColor || '#007bff')};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
          Voir l'article →
        </a>

        ${senderLine}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
          Cet email vous a été envoyé car un visiteur a utilisé le formulaire "Partager avec un ami" sur ${escapeHtml(siteName)}.
          Si vous ne connaissez pas l'expéditeur, vous pouvez ignorer cet email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

    // Send email
    const sent = await sendEmail({
      to: friendEmail.trim().toLowerCase(),
      subject,
      text: messageBody + `\n\nVoir l'article : ${productUrl}`,
      html,
    })

    // Collect email in DB if admin enabled it
    if (settings.shareCollectEmails) {
      await db.shareReferral.create({
        data: {
          friendEmail: friendEmail.trim().toLowerCase(),
          senderEmail: senderEmail ? senderEmail.trim().toLowerCase() : null,
          senderName: senderName ? senderName.trim() : null,
          productSku: stockItem.sku,
          productBrand: stockItem.brand,
          productTitle: stockItem.title,
        },
      })
    }

    if (!sent) {
      return NextResponse.json({
        ok: true,
        warning: 'Email non envoyé (SMTP non configuré) mais email collecté.',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/boutique/share/send error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
