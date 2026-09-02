import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import bwip from 'bwip-js'

/**
 * POST /api/stock/labels
 * Admin — generates a printable HTML page with labels (one per selected article).
 * Each label contains: product name, brand, SKU, barcode image (PNG), barcode number.
 *
 * Body: { ids: string[] }  — array of StockItem IDs
 *
 * Returns HTML with embedded base64 barcode images, ready to print (window.print()).
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

    // Generate barcode PNG (base64) for each item that has a barcode
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
            height: 40,
            includetext: true,
            textxalign: 'center',
            paddingwidth: 5,
            paddingheight: 3,
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

    // Build the HTML page
    const labelsHtml = labels.map((label, i) => `
      <div class="label" style="${i % 2 === 1 ? 'page-break-before: avoid;' : ''}">
        <div class="label-product">${escapeHtml(label.productName)}</div>
        <div class="label-brand">${escapeHtml(label.brand)}${label.sizeColor ? ` <span class="label-size">· ${escapeHtml(label.sizeColor)}</span>` : ''}</div>
        <div class="label-sku">SKU: ${escapeHtml(label.sku)}</div>
        ${label.barcodeImg
          ? `<div class="label-barcode"><img src="${label.barcodeImg}" alt="barcode" /></div>`
          : '<div class="label-no-barcode">Pas de code-barres</div>'
        }
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Étiquettes — ${labels.length} article(s)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 10mm; }
  .labels-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 5mm;
  }
  .label {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 4mm;
    width: 85mm;
    height: 54mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-inside: avoid;
  }
  .label-product {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label-brand {
    font-size: 11px;
    color: #666;
    margin-top: 1mm;
  }
  .label-size {
    color: #999;
  }
  .label-sku {
    font-size: 10px;
    color: #888;
    font-family: monospace;
    margin-top: 1mm;
  }
  .label-barcode {
    margin-top: 2mm;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    flex: 1;
  }
  .label-barcode img {
    max-height: 25mm;
    max-width: 100%;
    object-fit: contain;
  }
  .label-no-barcode {
    margin-top: 2mm;
    font-size: 10px;
    color: #ccc;
    text-align: center;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .print-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #1a1a1a;
    color: white;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }
  .print-bar button {
    background: #007bff;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  .print-bar button:hover { background: #0056b3; }
  @media print {
    .print-bar { display: none; }
    body { padding: 0; }
    .labels-grid { gap: 0; }
    .label { border: 1px solid #ddd; }
  }
  @page { margin: 5mm; size: A4; }
</style>
</head>
<body>
  <div class="print-bar">
    <span>📋 ${labels.length} étiquette(s) prête(s) à imprimer</span>
    <button onclick="window.print()">🖨️ Imprimer</button>
  </div>
  <div style="height: 50px;"></div>
  <div class="labels-grid">
    ${labelsHtml}
  </div>
  <script>
    // Auto-print after a short delay
    // setTimeout(() => window.print(), 500);
  </script>
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
