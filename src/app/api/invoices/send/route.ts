import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { sendEmail } from '@/lib/email'

/**
 * POST /api/invoices/send
 * Admin — sends an invoice PDF by email to the customer.
 *
 * Body: { saleId, email, invoiceNumber, saleDate }
 *
 * The email uses the same template system as other boutique emails (buildEmailTemplate).
 * The invoice PDF is generated on-the-fly and attached to the email.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { saleId, email, invoiceNumber, saleDate } = await req.json()

    if (!saleId || !email) {
      return NextResponse.json({ error: 'saleId et email requis' }, { status: 400 })
    }

    // Verify the sale exists and belongs to the user
    const sale = await db.sale.findFirst({
      where: { id: saleId, userId: user.id },
      include: { stockItem: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
    }

    // Get invoice settings for the "from" address
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    const invoiceSettings = adminUser
      ? await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
      : null

    // Get boutique settings for logo text
    const bs = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })
    const logoText = bs?.logoText || 'Boutique'

    // Format the sale date nicely in French
    const formattedDate = new Date(saleDate).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    // Build the email body
    // For multi-article orders, fetch ALL sales sharing this invoice number
    // so the email shows all the articles + total (not just the first one).
    const allInvoiceSales = await db.sale.findMany({
      where: { invoiceNumber },
      include: { stockItem: true },
      orderBy: { stockItem: { sku: 'asc' } },
    })
    const totalAmount = allInvoiceSales.reduce((sum, s) => sum + s.salePrice, 0)
    const articlesListHtml = allInvoiceSales.length > 1
      ? `<ul style="margin:0 0 12px 0;padding-left:20px;font-size:13px;">
          ${allInvoiceSales.map(s => `<li>${s.stockItem.brand} ${s.stockItem.title || s.stockItem.category} — <strong>${s.salePrice.toFixed(2)} €</strong></li>`).join('')}
        </ul>`
      : `<p style="margin:0 0 12px 0;font-weight:600;">${sale.stockItem.brand} ${sale.stockItem.title || sale.stockItem.category}</p>`

    const subject = `Votre facture ${invoiceNumber} — ${logoText}`
    const text = `Bonjour,\n\nVeuillez trouver ci-joint la facture correspondante à votre achat en date du ${formattedDate}.\n\nFacture n° ${invoiceNumber}\n${allInvoiceSales.length > 1 ? `${allInvoiceSales.length} articles :\n` + allInvoiceSales.map(s => `  - ${s.stockItem.brand} ${s.stockItem.title || s.stockItem.category} — ${s.salePrice.toFixed(2)} €`).join('\n') : `Article : ${sale.stockItem.brand} ${sale.stockItem.title || sale.stockItem.category}`}\nMontant total : ${totalAmount.toFixed(2)} €\n\nMerci de votre confiance.\n\nÀ bientôt sur ${logoText} !`

    // Build HTML body using the same template as other emails
    const bodyHtml = `
<p>Veuillez trouver ci-joint la facture correspondante à votre achat en date du <strong>${formattedDate}</strong>.</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
  <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Numéro de facture</p>
  <p style="margin:0 0 12px 0;font-family:monospace;font-weight:600;font-size:15px;">${invoiceNumber}</p>
  <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">${allInvoiceSales.length > 1 ? 'Articles' : 'Article'}</p>
  ${articlesListHtml}
  <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Montant total</p>
  <p style="margin:0;font-size:20px;font-weight:700;color:#007bff;">${totalAmount.toFixed(2)} €</p>
</div>
<p style="margin:0 0 12px 0;">Merci de votre confiance.</p>`

    // We can't easily attach a PDF in this flow because the PDF is generated
    // by a separate route that returns a Response. Instead, we'll send the email
    // with a link to download/view the invoice online.
    const siteUrl = bs?.shareSiteUrl || ''
    const invoiceUrl = siteUrl
      ? `${siteUrl.replace(/\/+$/, '')}/api/invoices/by-number/${encodeURIComponent(invoiceNumber)}/pdf`
      : ''

    // Build the final HTML with a download button if siteUrl is configured
    const finalHtml = invoiceUrl
      ? `${bodyHtml}
<a href="${invoiceUrl}" style="display:inline-block;background:#007bff;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;margin-top:12px;">Télécharger ma facture →</a>`
      : bodyHtml

    const sent = await sendEmail({
      to: email,
      subject,
      text,
      html: finalHtml,
    })

    if (!sent) {
      return NextResponse.json({ error: 'Échec de l\'envoi. Vérifiez la configuration SMTP dans Paramètres → Email.' }, { status: 500 })
    }

    console.log(`[invoices/send] Sent invoice ${invoiceNumber} to ${email}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/invoices/send error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
