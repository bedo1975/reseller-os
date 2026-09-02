import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import bwip from 'bwip-js'

/**
 * POST /api/stock/labels
 * Admin — generates a printable HTML page with labels (one per selected article).
 * Layout: horizontal — text left (product, brand, SKU) + barcode right.
 * Compact format to fit 10+ labels per A4 page (2 columns × 5+ rows).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { ids } = await req.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Aucun article sélectionné' }, { status: 400 })
    }

    const items = await db.stockItem.findMany({
      where: { id: { in: ids }, userId: user.id },
      select: {
        id: true,
        sku: true,
        brand: true,
        title: true,
        category: true,
        size: true,
        color: true,
        barcode: true,
      },
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'Aucun article trouvé' }, { status: 404 })
    }

    // Generate barcode PNG (base64) for each item
    const labels = await Promise.all(items.map(async (item) => {
      let barcodeImg = ''
      if (item.barcode) {
        try {
          const isEan13 = /^\d{13}$/.test(item.barcode)
          const bcid = isEan13 ? 'ean13' : 'code128'
          const pngBuffer = await bwip.toBuffer({
            bcid,
            text: item.barcode,
            scale: 2,
            height: 30,
            includetext: true,
            textxalign: 'center',
            paddingwidth: 3,
            paddingheight: 2,
          })
          barcodeImg = `data:image/png;base64,${pngBuffer.toString('base64')}`
        } catch (e) {
          console.error('[labels] Barcode generation failed for', item.sku, e)
        }
      }

      const productName = item.title || item.category || ''
      const sizeColor = [item.size && `T${item.size}`, item.color].filter(Boolean).join(' · ')

      return {
        productName,
        brand: item.brand,
        sku: item.sku,
        barcode: item.barcode || '',
        barcodeImg,
        sizeColor,
      }
    }))

    // Build labels HTML — horizontal layout: text left, barcode right
    const labelsHtml = labels.map(label => `
      <div class="label">
        <div class="label-left">
          <div class="label-product">${escapeHtml(label.productName)}</div>
          <div class="label-brand">${escapeHtml(label.brand)}${label.sizeColor ? ` <span class="label-sc">${escapeHtml(label.sizeColor)}</span>` : ''}</div>
          <div class="label-sku">${escapeHtml(label.sku)}</div>
        </div>
        <div class="label-right">
          ${label.barcodeImg
            ? `<img src="${label.barcodeImg}" alt="barcode" />`
            : '<span class="no-bc">Pas de code-barres</span>'
          }
        </div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Étiquettes — ${labels.length} article(s)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 8mm; }
  .labels-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3mm;
  }
  .label {
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 3mm;
    display: flex;
    align-items: center;
    gap: 3mm;
    height: 30mm;
    page-break-inside: avoid;
  }
  .label-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5mm;
  }
  .label-product {
    font-size: 12px;
    font-weight: 600;
    color: #1a1a1a;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label-brand {
    font-size: 10px;
    color: #555;
  }
  .label-sc {
    color: #999;
  }
  .label-sku {
    font-size: 9px;
    color: #888;
    font-family: monospace;
  }
  .label-right {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 45mm;
  }
  .label-right img {
    max-height: 24mm;
    max-width: 45mm;
    object-fit: contain;
  }
  .no-bc {
    font-size: 9px;
    color: #ccc;
    text-align: center;
  }
  .print-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #1a1a1a;
    color: white;
    padding: 8px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }
  .print-bar button {
    background: #007bff;
    color: white;
    border: none;
    padding: 6px 18px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .print-bar button:hover { background: #0056b3; }
  @media print {
    .print-bar { display: none; }
    body { padding: 0; }
    .labels-grid { gap: 0; }
  }
  @page { margin: 4mm; size: A4; }
</style>
</head>
<body>
  <div class="print-bar">
    <span>📋 ${labels.length} étiquette(s) — ${Math.ceil(labels.length / 10)} feuille(s)</span>
    <button onclick="window.print()">🖨️ Imprimer</button>
  </div>
  <div style="height: 40px;"></div>
  <div class="labels-grid">
    ${labelsHtml}
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('POST /api/stock/labels error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
