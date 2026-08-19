import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/size-guide
 * Public — returns all 3 size guides (men, women, kids) for display in the boutique popup.
 * No auth required.
 */
export async function GET() {
  try {
    const guides = await db.sizeGuide.findMany({ orderBy: { type: 'asc' } })

    // Parse JSON fields for the frontend
    const parsed = guides.map(g => ({
      type: g.type,
      title: g.title,
      image: g.image || g.imagePath || null,
      headers: JSON.parse(g.headers || '[]'),
      rows: JSON.parse(g.rows || '[]'),
    }))

    return NextResponse.json({ guides: parsed })
  } catch (error) {
    console.error('GET /api/boutique/size-guide error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
