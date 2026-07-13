import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueCategories } from '@/lib/boutique-settings'

/**
 * GET /api/boutique/nav
 * Public — returns categories + subcategories for the storefront navigation.
 */
export async function GET() {
  try {
    const categories = await getBoutiqueCategories()

    // Fetch subcategories from attributes
    const subcats = await db.attribute.findMany({
      where: { type: 'subcategory' },
      orderBy: { sortOrder: 'asc' },
    })

    // Group subcategories by parentCode
    const subcatMap: Record<string, { code: string; value: string }[]> = {}
    subcats.forEach(s => {
      if (s.parentCode) {
        if (!subcatMap[s.parentCode]) subcatMap[s.parentCode] = []
        subcatMap[s.parentCode].push({ code: s.code, value: s.value })
      }
    })

    const nav = categories.map(c => ({
      slug: c.slug,
      label: c.label,
      emoji: c.emoji,
      subcategories: subcatMap[c.slug] || [],
    }))

    return NextResponse.json({ nav })
  } catch (error) {
    console.error('GET /api/boutique/nav error:', error)
    return NextResponse.json({ nav: [] }, { status: 500 })
  }
}
