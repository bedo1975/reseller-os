import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

// POST /api/product-trends/export — export search results as CSV
// Body: { results: [{ title, price, url, platform, score, seller, location, postedDaysAgo }] }
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { results, searchName = 'recherche' } = body

    if (!Array.isArray(results)) {
      return NextResponse.json({ error: 'Format invalide — results doit être un tableau' }, { status: 400 })
    }

    const headers = ['Titre', 'Prix (€)', 'Plateforme', 'Score', 'Vendeur', 'Localisation', 'Publié (jours)', 'URL']
    const rows = results.map((r: any) => [
      escapeCsv(r.title || ''),
      r.price || 0,
      r.platform || '',
      r.score || 0,
      escapeCsv(r.seller || ''),
      r.location || '',
      r.postedDaysAgo || 0,
      r.url || '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.join(';'))
      .join('\n')

    // Add BOM for Excel UTF-8 compatibility
    const csvWithBom = '\uFEFF' + csv
    const filename = `tendances-${searchName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('POST /api/product-trends/export error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function escapeCsv(value: string): string {
  // Wrap in quotes and escape inner quotes
  return `"${value.replace(/"/g, '""')}"`
}
