import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { PassThrough } from 'stream'
// archiver v8 has a new API — use named import ZipArchive (ESM-compatible)
import { ZipArchive } from 'archiver'

/**
 * Export a stock item as a zip containing:
 *   - infos.txt       : all product info (formatted for easy copy-paste)
 *   - description.txt : just the description (ready to paste in Vinted)
 *   - vinted.txt      : Vinted-optimized template (title, description, price)
 *   - photos/01.jpg, 02.jpg, ... : all photos renamed in order
 *
 * The zip filename is derived from the product name (sanitized).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const item = await db.stockItem.findFirst({
      where: { id, userId: user.id },
    })
    if (!item) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // Parse photos
    let photos: string[] = []
    try { photos = JSON.parse(item.photos) } catch {}
    // Filter to only existing local files (skip external URLs for now)
    const localPhotos = photos.filter((p) => p.startsWith('/uploads/') || p.startsWith('/uploads/sessions/'))

    // Build product name (for zip filename and folder)
    const parts = [
      item.brand,
      item.category,
      item.size,
      item.color,
    ].filter(Boolean)
    const productName = parts.join(' ') || item.sku || 'article'
    const sanitized = productName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'article'

    // Format info content
    const fmtPrice = (n: any) => {
      const num = Number(n)
      return isNaN(num) || num === 0 ? '—' : `${num.toFixed(2)} €`
    }

    // Determine the suggested selling price for Vinted
    // Priority: suggestedPrice (from stock item) → calculated (purchaseCost × 2.5) → null
    const purchaseCost = Number(item.purchaseCost) || 0
    const suggestedPriceDb = Number(item.suggestedPrice) || 0
    let suggestedPrice: number | null = null
    let suggestedPriceLabel = ''
    if (suggestedPriceDb > 0) {
      suggestedPrice = suggestedPriceDb
      suggestedPriceLabel = `${suggestedPriceDb.toFixed(2)} €`
    } else if (purchaseCost > 0) {
      // Auto-calc: purchase × 2.5 (typical reseller margin)
      suggestedPrice = Math.round(purchaseCost * 2.5 * 100) / 100
      suggestedPriceLabel = `${suggestedPrice.toFixed(2)} € (auto: achat × 2.5)`
    } else {
      suggestedPriceLabel = 'À DÉFINIR'
    }

    const conditionMap: Record<string, string> = {
      'neuf': 'Neuf',
      'tres-bon': 'Très bon état',
      'bon': 'Bon état',
      'correct': 'Correct',
    }

    const infosTxt = `╔══════════════════════════════════════════════════════════╗
║         FICHE PRODUIT — Reseller OS                       ║
╚══════════════════════════════════════════════════════════╝

Nom du produit : ${productName}
SKU            : ${item.sku || '—'}
Code-barres    : ${item.barcode || '—'}

─── CARACTÉRISTIQUES ───
Marque     : ${item.brand || '—'}
Catégorie  : ${item.category || '—'}
Taille     : ${item.size || '—'}
Couleur    : ${item.color || '—'}
État       : ${conditionMap[item.condition] || item.condition || '—'}

─── PRIX ───
Prix d'achat     : ${fmtPrice(item.purchaseCost)}
Prix conseillé   : ${suggestedPriceLabel}

─── DESCRIPTION ───
${item.description || '(aucune description enregistrée)'}

─── LOGISTIQUE ───
Emplacement : ${[item.warehouse, item.rack, item.shelf, item.bin].filter(Boolean).join(' › ') || '—'}
Statut      : ${item.status || '—'}
Plateforme  : ${item.platforms || '—'}

─── PHOTOS ───
${localPhotos.length} photo(s) incluse(s) dans le dossier photos/

Généré le ${new Date().toLocaleString('fr-FR')}
`

    const descriptionTxt = item.description || '(aucune description)'

    // Vinted-optimized template
    const vintedTxt = `═══ TITRE ═══
${productName}

═══ DESCRIPTION ═══
${item.description || `${item.brand} ${item.category} ${item.size} ${item.color}`.trim()}

État : ${conditionMap[item.condition] || item.condition || 'Bon état'}
Marque : ${item.brand || '—'}
Taille : ${item.size || '—'}
Couleur : ${item.color || '—'}

═══ PRIX CONSEILLÉ ═══
${suggestedPriceLabel}

═══ PHOTOS ═══
Voir le dossier photos/ — la première (01) est la photo principale.
`

    // Build the zip (archiver v8 API: new ZipArchive(options))
    const archive = new ZipArchive({ zlib: { level: 9 } })

    // Append text files
    archive.append(infosTxt, { name: 'infos.txt' })
    archive.append(descriptionTxt, { name: 'description.txt' })
    archive.append(vintedTxt, { name: 'vinted-template.txt' })

    // Append photos (renamed 01.jpg, 02.jpg, ...)
    let photoIndex = 1
    for (const photoPath of localPhotos) {
      const fullPath = path.join(process.cwd(), 'public', photoPath)
      if (!fs.existsSync(fullPath)) continue

      const ext = path.extname(photoPath).toLowerCase() || '.jpg'
      const photoName = `${String(photoIndex).padStart(2, '0')}${ext}`
      const stream = fs.createReadStream(fullPath)
      archive.append(stream, { name: `photos/${photoName}` })
      photoIndex++
    }

    // Add a README
    const readme = `📂 ${sanitized}

Ce dossier contient :
  • infos.txt           → toutes les infos du produit
  • description.txt     → juste la description (prête à copier-coller)
  • vinted-template.txt → modèle optimisé pour Vinted
  • photos/             → ${localPhotos.length} photo(s) numérotées (01 = principale)

Workflow recommandé :
  1. Ouvrez vinted-template.txt → copiez le titre et la description
  2. Ajoutez les photos depuis le dossier photos/ (dans l'ordre)
  3. Saisissez le prix indiqué
  4. Validez l'annonce Vinted — environ 1 minute par produit !
`
    archive.append(readme, { name: 'README.txt' })

    // Collect zip output into a buffer via a PassThrough stream
    const passthrough = new PassThrough()
    const chunks: Buffer[] = []
    passthrough.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

    const finished = new Promise<Buffer>((resolve, reject) => {
      passthrough.on('end', () => resolve(Buffer.concat(chunks)))
      passthrough.on('error', reject)
    })

    archive.pipe(passthrough)
    archive.finalize()

    const buffer = await finished

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${sanitized}.zip"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/stock/[id]/export error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
