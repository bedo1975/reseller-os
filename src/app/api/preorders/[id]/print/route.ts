import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * GET /api/preorders/[id]/print
 * Auth — generates a printable pre-order document (bon de commande fournisseur).
 * Opens in a new tab and auto-triggers the print dialog.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const preorder = await db.preOrder.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
      include: { supplier: true },
    })
    if (!preorder) {
      return new NextResponse('Pré-commande introuvable', { status: 404 })
    }

    const settings = await getBoutiqueSettings()
    const subtitleText = settings.preparationSlipSubtitle || 'DBoxPro Boutique'

    const items = JSON.parse(preorder.items) as any[]

    const STATUS_LABELS: Record<string, string> = {
      pending: 'En attente',
      validated: 'Validée',
      received: 'Reçue',
      cancelled: 'Annulée',
    }

    const PAYMENT_LABELS: Record<string, string> = {
      especes: 'Espèces',
      carte_bancaire: 'Carte bancaire',
      virement: 'Virement',
      cheque: 'Chèque',
      paypal: 'PayPal',
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Bon de commande ${escapeHtml(preorder.reference)}</title>
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
  .sections { display: flex; gap: 30px; margin-bottom: 25px; flex-wrap: wrap; }
  .section { flex: 1; min-width: 200px; }
  .section-title { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; font-weight: 600; }
  .section-content { font-size: 13px; line-height: 1.6; }
  .section-content strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 2px solid #1a1a1a; }
  tbody td { padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
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
      <div class="title">BON DE COMMANDE</div>
      <div class="subtitle">${escapeHtml(subtitleText)}</div>
    </div>
    <div class="order-meta">
      <strong>${escapeHtml(preorder.reference)}</strong><br>
      ${new Date(preorder.orderDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
  </div>

  <div class="badges">
    <span class="badge badge-status">Statut : ${STATUS_LABELS[preorder.status] || preorder.status}</span>
    ${preorder.orderNumber ? `<span class="badge badge-date">Cmd : ${escapeHtml(preorder.orderNumber)}</span>` : ''}
    ${preorder.invoiceNumber ? `<span class="badge badge-date">Facture : ${escapeHtml(preorder.invoiceNumber)}</span>` : ''}
  </div>

  <div class="sections">
    <div class="section">
      <div class="section-title">Nom de la commande</div>
      <div class="section-content">
        <strong>${escapeHtml(preorder.name)}</strong>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Fournisseur</div>
      <div class="section-content">
        <strong>${escapeHtml(preorder.supplier?.name || preorder.supplierName || '—')}</strong>
        ${preorder.supplier?.email ? '<br>' + escapeHtml(preorder.supplier.email) : ''}
        ${preorder.supplier?.phone ? '<br>' + escapeHtml(preorder.supplier.phone) : ''}
        ${preorder.supplier?.address ? '<br>' + escapeHtml(preorder.supplier.address) : ''}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Paiement</div>
      <div class="section-content">
        ${preorder.paymentMethod ? escapeHtml(PAYMENT_LABELS[preorder.paymentMethod] || preorder.paymentMethod) : '—'}
      </div>
    </div>
  </div>

  ${preorder.notes ? `<div class="notes"><strong>Notes :</strong> ${escapeHtml(preorder.notes)}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Article</th>
        <th>Attributs</th>
        <th style="text-align:center;">Qté</th>
        <th style="text-align:right;">Prix unit.</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>
          <strong>${escapeHtml(item.designation || '—')}</strong>
          ${item.description ? '<br><span style="font-size:11px; color:#666;">' + escapeHtml(item.description) + '</span>' : ''}
          ${item.url ? '<br><a href="' + escapeHtml(item.url) + '" style="font-size:10px; color:#007bff;">Voir l\'article</a>' : ''}
        </td>
        <td style="font-size:11px; color:#666;">
          ${item.size ? 'Taille : ' + escapeHtml(item.size) + '<br>' : ''}
          ${item.color ? 'Couleur : ' + escapeHtml(item.color) + '<br>' : ''}
          ${item.condition ? 'État : ' + escapeHtml(item.condition) : ''}
        </td>
        <td style="text-align:center; font-weight:600; font-size:15px;">${item.quantity || 1}</td>
        <td style="text-align:right;">${(Number(item.unitPrice) || 0).toFixed(2)} €</td>
        <td style="text-align:right; font-weight:600;">${((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1)).toFixed(2)} €</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Sous-total</span>
      <span>${preorder.subtotal.toFixed(2)} €</span>
    </div>
    <div class="totals-row">
      <span>Frais de port</span>
      <span>${preorder.shippingCost === 0 ? 'Gratuit' : preorder.shippingCost.toFixed(2) + ' €'}</span>
    </div>
    <div class="totals-row grand">
      <span>Total</span>
      <span>${preorder.total.toFixed(2)} €</span>
    </div>
  </div>

  <div class="footer">
    <div class="signature">Signature fournisseur</div>
    <div class="signature">Date de commande</div>
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
    console.error('GET /api/preorders/[id]/print error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return new NextResponse('Non authentifié', { status: 401 })
    }
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
