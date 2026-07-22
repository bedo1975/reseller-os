import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueCategories } from '@/lib/boutique-settings'

/**
 * GET /api/boutique/categories
 * Public — returns the full category tree (top-level + subcategories) with product counts.
 * Uses BoutiqueCategory as the single source of truth (no more hardcoded labels).
 */
export async function GET() {
  try {
    const allCats = await getBoutiqueCategories()
    const topCats = allCats.filter(c => !c.parentId)

    // Count published products per top-level category
    const items = await db.stockItem.findMany({
      where: { status: 'PUBLIE', suggestedPrice: { gt: 0 } },
      select: { category: true, subcategory: true },
    })

    const counts: Record<string, number> = {}
    items.forEach(i => {
      if (i.category) counts[i.category] = (counts[i.category] || 0) + 1
    })

    // Build tree
    const categories = topCats.map(c => ({
      slug: c.slug,
      label: c.label,
      emoji: c.emoji,
      count: counts[c.slug] || 0,
      subcategories: allCats
        .filter(s => s.parentId === c.slug)
        .map(s => ({
          slug: s.slug,
          label: s.label,
          count: items.filter(i => i.category === c.slug && i.subcategory === s.slug).length,
        })),
    }))

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('GET /api/boutique/categories error:', error)
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}
