import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

// Helper pour récupérer ou créer les paramètres de facturation
async function getOrCreateInvoiceSettings(userId: string) {
  const existing = await db.invoiceSettings.findUnique({ where: { userId } })
  if (existing) return existing
  const user = await db.user.findUnique({ where: { id: userId } })
  return await db.invoiceSettings.create({
    data: {
      userId,
      companyName: user?.name || 'Ma Société',
      address: '',
      postalCode: '',
      city: '',
    },
  })
}

// Génère un numéro de facture séquentiel
async function generateInvoiceNumber(userId: string) {
  const settings = await getOrCreateInvoiceSettings(userId)
  const year = new Date().getFullYear()
  const prefix = settings.invoicePrefix.replace('{YEAR}', String(year))
  const nextCounter = settings.invoiceCounter + 1
  const paddedCounter = String(nextCounter).padStart(settings.invoicePadLength, '0')
  const invoiceNumber = `${prefix}${paddedCounter}`

  await db.invoiceSettings.update({
    where: { userId },
    data: { invoiceCounter: nextCounter },
  })

  return { number: invoiceNumber, settings }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// GET /api/invoices/[id]/pdf — Génère une facture HTML imprimable
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const sale = await db.sale.findFirst({
      where: { id, userId: user.id },
      include: { stockItem: true },
    })

    if (!sale) {
      return new Response('Facture introuvable', { status: 404 })
    }

    const settings = await getOrCreateInvoiceSettings(user.id)

    // Si pas de n° de facture, on en génère un rétroactivement
    let invoiceNumber = sale.invoiceNumber
    if (!invoiceNumber) {
      const { number } = await generateInvoiceNumber(user.id)
      invoiceNumber = number
      await db.sale.update({ where: { id }, data: { invoiceNumber } })
    }

    const saleDate = new Date(sale.saleDate)
    const formattedDate = saleDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    const vatRate = settings.vatEnabled ? settings.vatRate : 0
    const totalTTC = sale.salePrice
    const totalHT = settings.vatEnabled ? totalTTC / (1 + vatRate / 100) : totalTTC
    const totalVAT = totalTTC - totalHT

    const designation = `${sale.stockItem.brand} ${sale.stockItem.category} ${sale.stockItem.size || ''} ${sale.stockItem.color || ''}`.trim().replace(/\s+/g, ' ')
    const itemDescription = sale.stockItem.description || ''
    const shippingHT = settings.vatEnabled ? sale.shippingCost / (1 + vatRate / 100) : sale.shippingCost
    const shippingTTC = sale.shippingCost
    const feesTotal = (sale.platformFees || 0) + (sale.platformFixedFees || 0)

    // Look up the parent BoutiqueOrder — if a coupon was applied, prorate the discount
    // onto this invoice (each invoice = 1 item, but coupon applies to whole order).
    let couponCode: string | null = null
    let couponOrderId: string | null = null
    let orderSubtotal = 0
    let orderDiscountTotal = 0
    let proratedDiscountTTC = 0
    if (invoiceNumber) {
      try {
        const matchingOrders = await db.boutiqueOrder.findMany({
          where: { invoiceNumbers: { contains: invoiceNumber } },
          select: { orderId: true, couponCode: true, discountAmount: true, subtotal: true },
          take: 1,
        })
        const parentOrder = matchingOrders[0]
        if (parentOrder && parentOrder.couponCode && parentOrder.discountAmount > 0) {
          couponCode = parentOrder.couponCode
          couponOrderId = parentOrder.orderId
          orderSubtotal = parentOrder.subtotal
          orderDiscountTotal = parentOrder.discountAmount
          if (orderSubtotal > 0) {
            proratedDiscountTTC = orderDiscountTotal * (totalTTC / orderSubtotal)
            proratedDiscountTTC = Math.round(proratedDiscountTTC * 100) / 100
          }
        }
      } catch (e) {
        console.error('Coupon lookup failed:', e)
      }
    }

    const discountHT = settings.vatEnabled ? proratedDiscountTTC / (1 + vatRate / 100) : proratedDiscountTTC
    const grandTotalTTC = totalTTC - proratedDiscountTTC + shippingTTC
    const grandTotalHT = totalHT - discountHT + shippingHT

    const couponNotice = couponCode && proratedDiscountTTC > 0 ? `
      <div style="background:#ecfdf5; padding:10px 14px; border-radius:6px; font-size:11px; color:#065f46; margin-bottom:24px; border-left:3px solid #10b981;">
        <strong>🎁 Code promo <code style="font-family:monospace; background:#d1fae5; padding:1px 6px; border-radius:3px;">${escapeHtml(couponCode)}</code></strong>
        appliqué sur la commande <span style="color:#047857;">${escapeHtml(couponOrderId || '')}</span>.
        Remise totale commande : <strong>−${orderDiscountTotal.toFixed(2)} €</strong> sur sous-total de ${orderSubtotal.toFixed(2)} €.
        <div style="margin-top:2px; color:#047857; font-size:10px;">Part de cette facture : −${proratedDiscountTTC.toFixed(2)} € (prorata).</div>
      </div>` : ''

    // Parse customer contact (JSON for boutique sales, plain text for others)
    let customerAddress = ''
    let customerEmail = ''
    let customerPhone = ''
    if (sale.customerContact) {
      try {
        const parsed = JSON.parse(sale.customerContact)
        customerAddress = parsed.address || ''
        customerEmail = parsed.email || ''
        customerPhone = parsed.phone || ''
      } catch {
        customerAddress = sale.customerContact
      }
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Facture ${invoiceNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; font-size: 12px; padding: 30px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .company { max-width: 50%; }
  .company-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: #10b981; }
  .company-info { font-size: 11px; line-height: 1.5; color: #555; }
  .company-info div { margin-bottom: 2px; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; letter-spacing: 1px; }
  .invoice-number { font-size: 13px; color: #555; margin-bottom: 4px; }
  .invoice-date { font-size: 11px; color: #888; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .party { max-width: 45%; }
  .party-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  .party-content { font-size: 12px; line-height: 1.5; }
  .party-content strong { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 2px solid #1a1a1a; }
  tbody td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .totals { margin-left: auto; width: 280px; margin-bottom: 30px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
  .totals-row.grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-size: 15px; font-weight: 700; }
  .vat-notice { background: #fef3c7; padding: 10px 14px; border-radius: 6px; font-size: 11px; color: #92400e; margin-bottom: 24px; border-left: 3px solid #f59e0b; }
  .vat-applicable { background: #dbeafe; padding: 10px 14px; border-radius: 6px; font-size: 11px; color: #1e40af; margin-bottom: 24px; border-left: 3px solid #3b82f6; }
  .footer { margin-top: 50px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .legal { font-size: 10px; color: #888; line-height: 1.5; }
  @page { margin: 1.5cm; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      <div class="company-name">${escapeHtml(settings.companyName)}</div>
      <div class="company-info">
        <div>${escapeHtml(settings.address)}</div>
        <div>${escapeHtml(settings.postalCode)} ${escapeHtml(settings.city)}</div>
        <div>${escapeHtml(settings.country)}</div>
        ${settings.email ? `<div>Email : ${escapeHtml(settings.email)}</div>` : ''}
        ${settings.phone ? `<div>Tél : ${escapeHtml(settings.phone)}</div>` : ''}
        ${settings.siret ? `<div>SIRET : ${escapeHtml(settings.siret)}</div>` : ''}
        ${settings.rcs ? `<div>${escapeHtml(settings.rcs)}</div>` : ''}
        ${settings.vatEnabled && settings.vatNumber ? `<div>TVA : ${escapeHtml(settings.vatNumber)}</div>` : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-number">N° ${escapeHtml(invoiceNumber)}</div>
      <div class="invoice-date">Date : ${formattedDate}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Facturé à</div>
      <div class="party-content">
        <strong>${escapeHtml(sale.customerName || 'Client')}</strong>
        ${customerAddress ? `<div>${escapeHtml(customerAddress)}</div>` : ''}
        ${customerEmail ? `<div>Email : ${escapeHtml(customerEmail)}</div>` : ''}
        ${customerPhone ? `<div>Tél : ${escapeHtml(customerPhone)}</div>` : ''}
        <div style="color:#888; margin-top:4px;">Plateforme : ${escapeHtml(sale.platform)}</div>
      </div>
    </div>
    <div class="party" style="text-align:right;">
      <div class="party-label">N° de suivi colis</div>
      <div class="party-content">
        <strong>${sale.trackingNumber ? escapeHtml(sale.trackingNumber) : '—'}</strong>
      </div>
    </div>
  </div>

  ${couponNotice}

  <table>
    <thead>
      <tr>
        <th style="width: 45%;">Désignation</th>
        <th class="center" style="width: 8%;">Qté</th>
        ${settings.vatEnabled
          ? `<th class="right" style="width: 15%;">Prix unit. HT</th><th class="right" style="width: 10%;">TVA</th><th class="right" style="width: 15%;">Total HT</th>`
          : `<th class="right" style="width: 15%;">Prix unit. TTC</th><th class="right" style="width: 15%;">Total TTC</th>`
        }
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${escapeHtml(designation)}</strong>
          ${itemDescription ? `<div style="font-size:10px; color:#666; font-style:italic; margin-top:2px;">${escapeHtml(itemDescription.slice(0, 200))}${itemDescription.length > 200 ? '...' : ''}</div>` : ''}
          <div style="font-size:10px; color:#888; margin-top:2px;">SKU : ${escapeHtml(sale.stockItem.sku)}</div>
        </td>
        <td class="center">1</td>
        ${settings.vatEnabled
          ? `<td class="right">${totalHT.toFixed(2)} €</td><td class="right">${vatRate.toFixed(1)}%</td><td class="right">${totalHT.toFixed(2)} €</td>`
          : `<td class="right">${totalTTC.toFixed(2)} €</td><td class="right">${totalTTC.toFixed(2)} €</td>`
        }
      </tr>
      ${proratedDiscountTTC > 0 ? `
      <tr style="color:#065f46;">
        <td>
          <strong>Remise — Code promo ${escapeHtml(couponCode || '')}</strong>
          <div style="font-size:10px; color:#047857; margin-top:2px;">Prorata de la remise commande ${escapeHtml(couponOrderId || '')}</div>
        </td>
        <td class="center">1</td>
        ${settings.vatEnabled
          ? `<td class="right">−${discountHT.toFixed(2)} €</td><td class="right">${vatRate.toFixed(1)}%</td><td class="right">−${discountHT.toFixed(2)} €</td>`
          : `<td class="right">−${proratedDiscountTTC.toFixed(2)} €</td><td class="right">−${proratedDiscountTTC.toFixed(2)} €</td>`
        }
      </tr>` : ''}
      ${sale.shippingCost > 0 ? `
      <tr>
        <td>Frais de port</td>
        <td class="center">1</td>
        ${settings.vatEnabled
          ? `<td class="right">${shippingHT.toFixed(2)} €</td><td class="right">${vatRate.toFixed(1)}%</td><td class="right">${shippingHT.toFixed(2)} €</td>`
          : `<td class="right">${shippingTTC.toFixed(2)} €</td><td class="right">${shippingTTC.toFixed(2)} €</td>`
        }
      </tr>` : ''}
    </tbody>
  </table>

  <div class="totals">
    ${settings.vatEnabled ? `
      <div class="totals-row">
        <span>Total HT</span>
        <span>${grandTotalHT.toFixed(2)} €</span>
      </div>
      <div class="totals-row">
        <span>TVA (${vatRate.toFixed(1)}%)</span>
        <span>${(grandTotalTTC - grandTotalHT).toFixed(2)} €</span>
      </div>
    ` : ''}
    ${proratedDiscountTTC > 0 ? `
      <div class="totals-row" style="color:#065f46;">
        <span>Dont remise promo ${escapeHtml(couponCode || '')}</span>
        <span>−${proratedDiscountTTC.toFixed(2)} €</span>
      </div>
    ` : ''}
    <div class="totals-row grand">
      <span>Total TTC</span>
      <span>${grandTotalTTC.toFixed(2)} €</span>
    </div>
    ${feesTotal > 0 ? `
      <div class="totals-row" style="font-size:10px; color:#888;">
        <span>Dont frais plateforme</span>
        <span>${feesTotal.toFixed(2)} €</span>
      </div>
    ` : ''}
  </div>

  ${settings.vatEnabled
    ? `<div class="vat-applicable">TVA applicable — Régime normal. TVA ${vatRate.toFixed(1)}% incluse.</div>`
    : `<div class="vat-notice">${escapeHtml(settings.vatExemptionText || 'TVA non applicable, art. 293 B du CGI — franchise en base')}</div>`
  }

  <div class="footer">
    ${settings.legalMentions ? `
      <div class="legal">${escapeHtml(settings.legalMentions)}</div>
    ` : `
      <div class="legal">Document généré électroniquement par Reseller OS le ${new Date().toLocaleDateString('fr-FR')}.</div>
    `}
  </div>

  <script>window.onload = () => { setTimeout(() => window.print(), 300); }</script>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return new Response('Non authentifié', { status: 401 })
    }
    console.error('GET /api/invoices/[id]/pdf error:', error)
    return new Response('Erreur serveur', { status: 500 })
  }
}
