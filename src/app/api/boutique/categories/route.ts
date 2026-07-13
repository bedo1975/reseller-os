import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/categories
 * Public — returns categories with their product counts.
 */
export async function GET() {
  try {
    const items = await db.stockItem.findMany({
      where: { status: 'PUBLIE', suggestedPrice: { gt: 0 } },
      select: { category: true },
    })

    const counts: Record<string, number> = {}
    items.forEach(i => {
      if (i.category) counts[i.category] = (counts[i.category] || 0) + 1
    })

    const categoryLabels: Record<string, string> = {
      vetements: 'Vêtements',
      chaussures: 'Chaussures',
      accessoires: 'Accessoires',
      luxe: 'Luxe',
      maison: 'Maison',
    }

    const categories = Object.entries(counts).map(([slug, count]) => ({
      slug,
      label: categoryLabels[slug] || slug,
      count,
    }))

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('GET /api/boutique/categories error:', error)
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}
