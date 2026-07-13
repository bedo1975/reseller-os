import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
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
 * GET /api/boutique/admin/orders/[id]/preparation
 * Admin — generates a printable preparation slip (bon de préparation).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const order = await db.boutiqueOrder.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!order) {
      return new NextResponse('Commande introuvable', { status: 404 })
    }

    const items = JSON.parse(order.items) as any[]

    // Fetch descriptions from StockItems
    const skus = items.map(i => i.sku).filter(Boolean)
    const stockItems = await db.stockItem.findMany({
      where: { sku: { in: skus } },
      select: { sku: true, description: true },
    })
    const descMap = new Map(stockItems.map(s => [s.sku, s.description]))

    const customer = order.clientId ? null : (() => {
      try { return JSON.parse(order.customerSnapshot) } catch { return {} }
    })()

    const clientName = order.client
      ? `${order.client.firstName} ${order.client.lastName}`
      : `${(customer as any)?.firstName || ''} ${(customer as any)?.lastName || ''}`
    const clientEmail = order.client?.email || (customer as any)?.email || ''
    const clientPhone = order.client?.phone || (customer as any)?.phone || ''
    const clientAddress = order.client?.address || (customer as any)?.address || ''

    const STATUS_LABELS: Record<string, string> = {
      pending: 'En attente', paid: 'Payée', shipped: 'Expédiée',
      delivered: 'Livrée', cancelled: 'Annulée',
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bon de préparation ${escapeHtml(order.orderId)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; font-size: 13px; padding: 25px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #007bff; }
  .title { font-size: 22px; font-weight: 700; color: #007bff; }
  .subtitle { font-size: 12px; color: #555; margin-top: 4px; }
  .order-meta { text-align: right; font-size: 12px; }
  .order-meta strong { font-size: 14px; color: #1a1a1a; }
  .badges { display: flex; gap: 8px; margin-bottom: 20px; }
  .badge { padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-status { background: #fef3c7; color: #92400e; }
  .badge-date { background: #dbeafe; color: #1e40af; }
  .sections { display: flex; gap: 30px; margin-bottom: 25px; }
  .section { flex: 1; }
  .section-title { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; font-weight: 600; }
  .section-content { font-size: 13px; line-height: 1.6; }
  .section-content strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 2px solid #1a1a1a; }
  tbody td { padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
  .check-col { width: 40px; text-align: center; }
  .checkbox { width: 18px; height: 18px; border: 2px solid #999; border-radius: 3px; display: inline-block; }
  .totals { margin-left: auto; width: 250px; margin-bottom: 20px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .totals-row.grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 700; }
  .notes { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 12px; margin-bottom: 20px; }
  .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; }
  .signature { width: 200px; border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #666; }
  @page { margin: 1cm; size: A4; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">BON DE PRÉPARATION</div>
      <div class="subtitle">DBoxPro Boutique</div>
    </div>
    <div class="order-meta">
      <strong>${escapeHtml(order.orderId)}</strong><br>
      ${new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
  </div>

  <div class="badges">
    <span class="badge badge-status">Statut : ${STATUS_LABELS[order.status] || order.status}</span>
    <span class="badge badge-date">${new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>

  <div class="sections">
    <div class="section">
      <div class="section-title">Client</div>
      <div class="section-content">
        <strong>${escapeHtml(clientName)}</strong><br>
        ${clientEmail ? escapeHtml(clientEmail) + '<br>' : ''}
        ${clientPhone ? escapeHtml(clientPhone) + '<br>' : ''}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Adresse de livraison</div>
      <div class="section-content">
        ${escapeHtml(clientAddress) || '—'}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Livraison</div>
      <div class="section-content">
        ${escapeHtml(order.shippingMethod)}<br>
        ${order.paymentMethod ? 'Paiement : ' + escapeHtml(order.paymentMethod) : ''}
      </div>
    </div>
  </div>

  ${order.notes ? `<div class="notes"><strong>Notes :</strong> ${escapeHtml(order.notes)}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th class="check-col">✓</th>
        <th style="width: 60%;">Article</th>
        <th class="check-col" style="text-align:center;">Qté</th>
        <th style="text-align:right;">Prix unit.</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => {
        const desc = descMap.get(item.sku)
        return `
      <tr>
        <td class="check-col"><span class="checkbox"></span></td>
        <td>
          <strong>${escapeHtml(item.brand || '')}</strong> ${escapeHtml(item.category || '')}
          ${item.size ? '<br><span style="font-size:11px; color:#666;">Taille : ' + escapeHtml(item.size) + '</span>' : ''}
          ${item.color ? '<br><span style="font-size:11px; color:#666;">Couleur : ' + escapeHtml(item.color) + '</span>' : ''}
          ${desc ? '<br><span style="font-size:11px; color:#666; font-style:italic;">' + escapeHtml(desc.slice(0, 150)) + (desc.length > 150 ? '...' : '') + '</span>' : ''}
          ${item.sku ? '<br><span style="font-size:10px; color:#999; font-family:monospace;">SKU : ' + escapeHtml(item.sku) + '</span>' : ''}
        </td>
        <td style="text-align:center; font-weight:600; font-size:15px;">${item.qty || 1}</td>
        <td style="text-align:right;">${(item.price || 0).toFixed(2)} €</td>
        <td style="text-align:right; font-weight:600;">${((item.price || 0) * (item.qty || 1)).toFixed(2)} €</td>
      </tr>`
      }).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Sous-total</span>
      <span>${order.subtotal.toFixed(2)} €</span>
    </div>
    <div class="totals-row">
      <span>Livraison</span>
      <span>${order.shippingCost === 0 ? 'Gratuit' : order.shippingCost.toFixed(2) + ' €'}</span>
    </div>
    <div class="totals-row grand">
      <span>Total</span>
      <span>${order.total.toFixed(2)} €</span>
    </div>
  </div>

  <div class="footer">
    <div class="signature">Préparé par (signature)</div>
    <div class="signature">Date de préparation</div>
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
    console.error('GET /api/boutique/admin/orders/[id]/preparation error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return new NextResponse('Non authentifié', { status: 401 })
    }
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
