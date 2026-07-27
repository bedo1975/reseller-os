import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * GET /api/invoices/by-number/[number]/pdf
 * PUBLIC — generates an invoice HTML by invoice number (for boutique clients).
 * No auth required (clients access their invoices via their account).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params

    const sale = await db.sale.findFirst({
      where: { invoiceNumber: number },
      include: { stockItem: true },
    })

    if (!sale) {
      return new NextResponse('Facture introuvable', { status: 404 })
    }

    // Get admin's invoice settings
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    if (!adminUser) {
      return new NextResponse('Configuration manquante', { status: 500 })
    }
    const settings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
    if (!settings) {
      return new NextResponse('Paramètres de facturation manquants', { status: 500 })
    }

    const invoiceNumber = sale.invoiceNumber || number
    const saleDate = new Date(sale.saleDate)
    const formattedDate = saleDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    const vatRate = settings.vatEnabled ? settings.vatRate : 0
    const totalTTC = sale.salePrice
    const totalHT = settings.vatEnabled ? totalTTC / (1 + vatRate / 100) : totalTTC
    const totalVAT = totalTTC - totalHT
    const shippingHT = settings.vatEnabled ? sale.shippingCost / (1 + vatRate / 100) : sale.shippingCost
    const shippingTTC = sale.shippingCost
    const grandTotalTTC = totalTTC + shippingTTC
    const grandTotalHT = totalHT + shippingHT

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
        // Not JSON — it's plain text (legacy sales)
        customerAddress = sale.customerContact
      }
    }

    const designation = `${sale.stockItem.brand} ${sale.stockItem.category} ${sale.stockItem.size || ''} ${sale.stockItem.color || ''}`.trim().replace(/\s+/g, ' ')
    const itemDescription = sale.stockItem.description || ''

    // Look up the parent BoutiqueOrder (if this sale belongs to a boutique order with a coupon)
    let couponNotice = ''
    try {
      // Find BoutiqueOrder where invoiceNumbers JSON contains this invoiceNumber
      const matchingOrders = await db.boutiqueOrder.findMany({
        where: { invoiceNumbers: { contains: invoiceNumber } },
        select: { orderId: true, couponCode: true, discountAmount: true, subtotal: true },
        take: 1,
      })
      const parentOrder = matchingOrders[0]
      if (parentOrder && parentOrder.couponCode && parentOrder.discountAmount > 0) {
        couponNotice = `
          <div style="background:#ecfdf5; padding:10px 14px; border-radius:6px; font-size:11px; color:#065f46; margin-bottom:24px; border-left:3px solid #10b981;">
            <strong>🎁 Code promo appliqué :</strong> <code style="font-family:monospace; background:#d1fae5; padding:1px 6px; border-radius:3px;">${escapeHtml(parentOrder.couponCode)}</code>
            — remise de <strong>${parentOrder.discountAmount.toFixed(2)} €</strong> sur l'ensemble de la commande
            <span style="color:#047857;">(${escapeHtml(parentOrder.orderId)})</span>.
            <div style="margin-top:4px; color:#047857; font-size:10px;">
              Sous-total commande : ${parentOrder.subtotal.toFixed(2)} € · Remise : −${parentOrder.discountAmount.toFixed(2)} €
            </div>
          </div>`
      }
    } catch (e) {
      console.error('Coupon lookup failed:', e)
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Facture ${escapeHtml(invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; font-size: 12px; padding: 30px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .company { max-width: 50%; }
  .company-name { font-size: 18px; font-weight: 700; margin-bottom: 6px; color: #007bff; }
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
    <div class="totals-row grand">
      <span>Total TTC</span>
      <span>${grandTotalTTC.toFixed(2)} €</span>
    </div>
  </div>

  ${settings.vatEnabled
    ? `<div class="vat-applicable">TVA applicable — Régime normal. TVA ${vatRate.toFixed(1)}% incluse.</div>`
    : `<div class="vat-notice">${escapeHtml(settings.vatExemptionText || 'TVA non applicable, art. 293 B du CGI — franchise en base')}</div>`
  }

  <div class="footer">
    <div class="legal">Document généré électroniquement par Reseller OS le ${new Date().toLocaleDateString('fr-FR')}.</div>
  </div>

  <script>window.onload = () => { setTimeout(() => window.print(), 300); }</script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/invoices/by-number/[number]/pdf error:', error)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
