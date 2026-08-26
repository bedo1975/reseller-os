import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

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

// Strip HTML tags from a description (descriptions may contain HTML from the WYSIWYG editor)
function stripHtml(raw: string): string {
  return String(raw || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// GET /api/invoices/[id]/pdf — Génère une facture HTML imprimable
// Fetches ALL sales sharing the same invoice number (so multi-article orders
// produce ONE invoice with all the articles, not one invoice per article).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Fetch the "anchor" sale (used to determine the invoice number)
    const anchorSale = await db.sale.findFirst({
      where: { id, userId: user.id },
      include: { stockItem: true },
    })

    if (!anchorSale) {
      return new Response('Facture introuvable', { status: 404 })
    }

    const settings = await getOrCreateInvoiceSettings(user.id)

    // Fetch boutique settings for the configurable footer text
    const boutiqueSettings = await getBoutiqueSettings()
    const todayStr = new Date().toLocaleDateString('fr-FR')
    const footerText = boutiqueSettings.invoiceFooterText
      ? `${boutiqueSettings.invoiceFooterText} — ${todayStr}`
      : null  // null → use existing logic (legalMentions or default)

    // Si pas de n° de facture, on en génère un rétroactivement
    let invoiceNumber = anchorSale.invoiceNumber
    if (!invoiceNumber) {
      const { number } = await generateInvoiceNumber(user.id)
      invoiceNumber = number
      await db.sale.update({ where: { id }, data: { invoiceNumber } })
    }

    // Fetch ALL sales sharing this invoice number — they all belong to the same order
    // and should be displayed on a single invoice document.
    const allSales = await db.sale.findMany({
      where: { invoiceNumber },
      include: { stockItem: true },
      orderBy: { stockItem: { sku: 'asc' } },
    })

    if (allSales.length === 0) {
      // Should never happen since anchorSale matches, but defensive
      return new Response('Facture introuvable', { status: 404 })
    }

    // Use the first sale for customer info + sale date (they're all the same order)
    const firstSale = allSales[0]
    const saleDate = new Date(firstSale.saleDate)
    const formattedDate = saleDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    const vatRate = settings.vatEnabled ? settings.vatRate : 0

    // ── Build line items (one per Sale) ──────────────────────────────────────
    // Each Sale = 1 article (qty is on the Sale.stockItem, not on the Sale itself).
    // For boutique orders, each Sale has qty=1 (the checkout creates 1 Sale per article).
    // For manual sales, there's only 1 Sale per invoice (no grouping needed).
    type LineItem = {
      designation: string
      description: string
      sku: string
      qty: number
      unitPriceTTC: number
      unitPriceHT: number
      lineTotalTTC: number
      lineTotalHT: number
    }
    const lineItems: LineItem[] = allSales.map(s => {
      const unitPriceTTC = s.salePrice
      const unitPriceHT = settings.vatEnabled ? unitPriceTTC / (1 + vatRate / 100) : unitPriceTTC
      // Use the Sale's qty field (defaults to 1 for legacy Sales created before this field existed).
      // This correctly handles multi-qty items (e.g. 2× the same SKU ordered in one checkout).
      const qty = (s as { qty?: number }).qty || 1
      return {
        designation: `${s.stockItem.brand} ${s.stockItem.category} ${s.stockItem.size || ''} ${s.stockItem.color || ''}`.trim().replace(/\s+/g, ' '),
        description: stripHtml(s.stockItem.description || ''),
        sku: s.stockItem.sku,
        qty,
        unitPriceTTC,
        unitPriceHT,
        lineTotalTTC: unitPriceTTC * qty,
        lineTotalHT: unitPriceHT * qty,
      }
    })

    // ── Totals (sum across all sales) ────────────────────────────────────────
    // Shipping cost: each Sale has its prorated share — we sum them to get the order's total shipping.
    const totalShippingTTC = allSales.reduce((sum, s) => sum + (s.shippingCost || 0), 0)
    const totalShippingHT = settings.vatEnabled ? totalShippingTTC / (1 + vatRate / 100) : totalShippingTTC

    // Items total (sum of all line totals)
    const itemsTotalTTC = lineItems.reduce((sum, it) => sum + it.lineTotalTTC, 0)
    const itemsTotalHT = lineItems.reduce((sum, it) => sum + it.lineTotalHT, 0)

    // ── Coupon (parent BoutiqueOrder lookup) ─────────────────────────────────
    let couponCode: string | null = null
    let couponOrderId: string | null = null
    let orderSubtotal = 0
    let orderDiscountTotal = 0
    let proratedDiscountTTC = 0
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
          // Discount applies to whole order — this invoice covers ALL items, so use full discount
          proratedDiscountTTC = orderDiscountTotal
          proratedDiscountTTC = Math.round(proratedDiscountTTC * 100) / 100
        }
      }
    } catch (e) {
      console.error('Coupon lookup failed:', e)
    }

    const discountHT = settings.vatEnabled ? proratedDiscountTTC / (1 + vatRate / 100) : proratedDiscountTTC
    const grandTotalTTC = itemsTotalTTC - proratedDiscountTTC + totalShippingTTC
    const grandTotalHT = itemsTotalHT - discountHT + totalShippingHT
    const totalVAT = grandTotalTTC - grandTotalHT
    const feesTotal = allSales.reduce((sum, s) => sum + (s.platformFees || 0) + (s.platformFixedFees || 0), 0)

    const couponNotice = couponCode && proratedDiscountTTC > 0 ? `
      <div style="background:#ecfdf5; padding:10px 14px; border-radius:6px; font-size:11px; color:#065f46; margin-bottom:24px; border-left:3px solid #10b981;">
        <strong>🎁 Code promo <code style="font-family:monospace; background:#d1fae5; padding:1px 6px; border-radius:3px;">${escapeHtml(couponCode)}</code></strong>
        appliqué sur la commande <span style="color:#047857;">${escapeHtml(couponOrderId || '')}</span>.
        Remise : <strong>−${orderDiscountTotal.toFixed(2)} €</strong> sur sous-total de ${orderSubtotal.toFixed(2)} €.
      </div>` : ''

    // Parse customer contact (JSON for boutique sales, plain text for others)
    let customerAddress = ''
    let customerEmail = ''
    let customerPhone = ''
    if (firstSale.customerContact) {
      try {
        const parsed = JSON.parse(firstSale.customerContact)
        customerAddress = parsed.address || ''
        customerEmail = parsed.email || ''
        customerPhone = parsed.phone || ''
      } catch {
        customerAddress = firstSale.customerContact
      }
    }

    // Build the items table rows
    const itemsRowsHtml = lineItems.map(it => `
      <tr>
        <td>
          <strong>${escapeHtml(it.designation)}</strong>
          ${it.description ? `<div style="font-size:10px; color:#666; font-style:italic; margin-top:2px;">${escapeHtml(it.description.slice(0, 200))}${it.description.length > 200 ? '...' : ''}</div>` : ''}
          <div style="font-size:10px; color:#888; margin-top:2px;">SKU : ${escapeHtml(it.sku)}</div>
        </td>
        <td class="center">${it.qty}</td>
        ${settings.vatEnabled
          ? `<td class="right">${it.unitPriceHT.toFixed(2)} €</td><td class="right">${vatRate.toFixed(1)}%</td><td class="right">${it.lineTotalHT.toFixed(2)} €</td>`
          : `<td class="right">${it.unitPriceTTC.toFixed(2)} €</td><td class="right">${it.lineTotalTTC.toFixed(2)} €</td>`
        }
      </tr>`).join('')

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
        ${settings.repIdu ? `<div>IDU REP : ${escapeHtml(settings.repIdu)}</div>` : ''}
        ${settings.vatEnabled && settings.vatNumber ? `<div>TVA : ${escapeHtml(settings.vatNumber)}</div>` : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-number">N° ${escapeHtml(invoiceNumber)}</div>
      <div class="invoice-date">Date : ${formattedDate}</div>
      ${(() => {
        const totalArticleCount = allSales.reduce((sum, s) => sum + ((s as { qty?: number }).qty || 1), 0)
        return totalArticleCount > 1
          ? `<div style="font-size:10px; color:#888; margin-top:4px;">${totalArticleCount} articles</div>`
          : ''
      })()}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">Facturé à</div>
      <div class="party-content">
        <strong>${escapeHtml(firstSale.customerName || 'Client')}</strong>
        ${customerAddress ? `<div>${escapeHtml(customerAddress)}</div>` : ''}
        ${customerEmail ? `<div>Email : ${escapeHtml(customerEmail)}</div>` : ''}
        ${customerPhone ? `<div>Tél : ${escapeHtml(customerPhone)}</div>` : ''}
        <div style="color:#888; margin-top:4px;">Plateforme : ${escapeHtml(firstSale.platform)}</div>
      </div>
    </div>
    <div class="party" style="text-align:right;">
      <div class="party-label">N° de suivi colis</div>
      <div class="party-content">
        <strong>${firstSale.trackingNumber ? escapeHtml(firstSale.trackingNumber) : '—'}</strong>
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
      ${itemsRowsHtml}
      ${proratedDiscountTTC > 0 ? `
      <tr style="color:#065f46;">
        <td>
          <strong>Remise — Code promo ${escapeHtml(couponCode || '')}</strong>
          <div style="font-size:10px; color:#047857; margin-top:2px;">Remise commande ${escapeHtml(couponOrderId || '')}</div>
        </td>
        <td class="center">1</td>
        ${settings.vatEnabled
          ? `<td class="right">−${discountHT.toFixed(2)} €</td><td class="right">${vatRate.toFixed(1)}%</td><td class="right">−${discountHT.toFixed(2)} €</td>`
          : `<td class="right">−${proratedDiscountTTC.toFixed(2)} €</td><td class="right">−${proratedDiscountTTC.toFixed(2)} €</td>`
        }
      </tr>` : ''}
      ${totalShippingTTC > 0 ? `
      <tr>
        <td>Frais de port</td>
        <td class="center">1</td>
        ${settings.vatEnabled
          ? `<td class="right">${totalShippingHT.toFixed(2)} €</td><td class="right">${vatRate.toFixed(1)}%</td><td class="right">${totalShippingHT.toFixed(2)} €</td>`
          : `<td class="right">${totalShippingTTC.toFixed(2)} €</td><td class="right">${totalShippingTTC.toFixed(2)} €</td>`
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
        <span>${totalVAT.toFixed(2)} €</span>
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
    ${footerText ? `
      <div class="legal">${escapeHtml(footerText)}</div>
    ` : settings.legalMentions ? `
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
