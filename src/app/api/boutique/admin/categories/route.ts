import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { getBoutiqueCategories } from '@/lib/boutique-settings'

// GET — public (returns categories for the storefront)
export async function GET() {
  try {
    const categories = await getBoutiqueCategories()
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('GET /api/boutique/admin/categories error:', error)
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}

// POST — admin only (create or update category)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { slug, label, emoji, backgroundImage, order } = body

    if (!slug || !label) {
      return NextResponse.json({ error: 'Slug et libellé requis' }, { status: 400 })
    }

    const category = await db.boutiqueCategory.upsert({
      where: { slug: slug.trim() },
      create: {
        slug: slug.trim(),
        label: label.trim(),
        emoji: emoji?.trim() || '📦',
        backgroundImage: backgroundImage || null,
        order: parseInt(order) || 0,
      },
      update: {
        label: label.trim(),
        emoji: emoji?.trim() || '📦',
        backgroundImage: backgroundImage || null,
        order: parseInt(order) || 0,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('POST /api/boutique/admin/categories error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
