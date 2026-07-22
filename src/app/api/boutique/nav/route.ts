import { NextResponse } from 'next/server'
import { getBoutiqueCategories } from '@/lib/boutique-settings'

// GET — public (returns nav tree for the storefront header)
export async function GET() {
  try {
    const allCats = await getBoutiqueCategories()
    const topCats = allCats.filter(c => !c.parentId)

    // Build nav: top-level categories with their subcategories
    const nav = topCats.map(c => ({
      slug: c.slug,
      label: c.label,
      emoji: c.emoji,
      subcategories: allCats
        .filter(s => s.parentId === c.slug)
        .map(s => ({ slug: s.slug, label: s.label })),
    }))

    return NextResponse.json({ nav })
  } catch (error) {
    console.error('GET /api/boutique/nav error:', error)
    return NextResponse.json({ nav: [] }, { status: 500 })
  }
}
