import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/boutique/admin/size-guide
 * Admin — returns all 3 size guides (men, women, kids). Creates them with defaults if they don't exist.
 */
export async function GET() {
  try {
    await requireAuth()

    const DEFAULTS = [
      { type: 'men', title: 'Guide des tailles — Hommes' },
      { type: 'women', title: 'Guide des tailles — Femmes' },
      { type: 'kids', title: 'Guide des tailles — Enfants' },
    ]

    // Ensure all 3 types exist (create with defaults if missing)
    for (const def of DEFAULTS) {
      const existing = await db.sizeGuide.findUnique({ where: { type: def.type } })
      if (!existing) {
        await db.sizeGuide.create({
          data: {
            type: def.type,
            title: def.title,
            headers: JSON.stringify(['Taille FR', 'Taille US', 'Tour de poitrine (cm)', 'Tour de taille (cm)', 'Tour de hanches (cm)']),
            rows: JSON.stringify([
              ['XS', 'XS', '84', '66', '90'],
              ['S', 'S', '88', '70', '94'],
              ['M', 'M', '92', '74', '98'],
              ['L', 'L', '96', '78', '102'],
              ['XL', 'XL', '100', '82', '106'],
              ['XXL', 'XXL', '104', '86', '110'],
              ['3XL', '3XL', '108', '90', '114'],
            ]),
          },
        })
      }
    }

    const guides = await db.sizeGuide.findMany({ orderBy: { type: 'asc' } })

    // Parse JSON fields for the frontend
    const parsed = guides.map(g => ({
      ...g,
      headers: JSON.parse(g.headers || '[]'),
      rows: JSON.parse(g.rows || '[]'),
    }))

    return NextResponse.json({ guides: parsed })
  } catch (error) {
    console.error('GET /api/boutique/admin/size-guide error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PUT /api/boutique/admin/size-guide
 * Admin — updates a specific size guide (by type).
 *
 * Body: { type, title, image, headers, rows }
 */
export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { type, title, image, imagePath, headers, rows } = body

    if (!type || !['men', 'women', 'kids'].includes(type)) {
      return NextResponse.json({ error: 'Type invalide (men, women, or kids)' }, { status: 400 })
    }

    // Validate headers: must be an array of 5 strings
    if (!Array.isArray(headers) || headers.length !== 5) {
      return NextResponse.json({ error: 'headers doit contenir 5 éléments' }, { status: 400 })
    }

    // Validate rows: must be an array of up to 7 rows, each with 5 values
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 7) {
      return NextResponse.json({ error: 'rows doit contenir 1 à 7 lignes' }, { status: 400 })
    }
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 5) {
        return NextResponse.json({ error: 'Chaque ligne doit contenir 5 valeurs' }, { status: 400 })
      }
    }

    // Upsert (create if doesn't exist, update if it does)
    const guide = await db.sizeGuide.upsert({
      where: { type },
      create: {
        type,
        title: title || 'Guide des tailles',
        image: image || null,
        imagePath: imagePath || null,
        headers: JSON.stringify(headers),
        rows: JSON.stringify(rows),
      },
      update: {
        title: title ?? undefined,
        image: image ?? undefined,
        imagePath: imagePath ?? undefined,
        headers: JSON.stringify(headers),
        rows: JSON.stringify(rows),
      },
    })

    return NextResponse.json(guide)
  } catch (error) {
    console.error('PUT /api/boutique/admin/size-guide error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/boutique/admin/size-guide/upload
 * Admin — upload an image for a specific size guide (multipart form-data).
 * Returns { path: "/api/uploads/size-guide/xxx.webp" }
 *
 * This is a sub-route handled in /api/boutique/admin/size-guide/upload/route.ts
 */
