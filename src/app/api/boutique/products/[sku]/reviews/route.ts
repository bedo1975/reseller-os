import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/products/[sku]/reviews
 * Public — returns all active reviews for a product.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const { sku } = await params

    const reviews = await db.productReview.findMany({
      where: { productSku: sku, active: true },
      orderBy: { createdAt: 'desc' },
    })

    // Compute average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

    return NextResponse.json({
      reviews,
      stats: {
        count: reviews.length,
        avgRating: parseFloat(avgRating.toFixed(1)),
      },
    })
  } catch (error) {
    console.error('GET /api/boutique/products/[sku]/reviews error:', error)
    return NextResponse.json({ reviews: [], stats: { count: 0, avgRating: 0 } }, { status: 500 })
  }
}

/**
 * POST /api/boutique/products/[sku]/reviews
 * Public — submit a new review.
 *
 * Body: { authorName: string, rating: number (1-5), title?: string, comment?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const { sku } = await params
    const body = await req.json()
    const { authorName, rating, title, comment } = body

    if (!authorName || typeof authorName !== 'string' || authorName.trim().length < 2) {
      return NextResponse.json({ error: 'Nom requis (2 caractères minimum)' }, { status: 400 })
    }

    const ratingNum = parseInt(rating)
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'Note invalide (1 à 5 étoiles)' }, { status: 400 })
    }

    // Check the product exists
    const product = await db.stockItem.findFirst({
      where: { sku, status: 'PUBLIE', quantity: { gt: 0 } },
      select: { sku: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // Limit comment length
    const cleanComment = comment ? String(comment).trim().slice(0, 2000) : null
    const cleanTitle = title ? String(title).trim().slice(0, 200) : null

    const review = await db.productReview.create({
      data: {
        productSku: sku,
        authorName: authorName.trim().slice(0, 100),
        rating: ratingNum,
        title: cleanTitle,
        comment: cleanComment,
        active: true,
      },
    })

    return NextResponse.json(review)
  } catch (error) {
    console.error('POST /api/boutique/products/[sku]/reviews error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
