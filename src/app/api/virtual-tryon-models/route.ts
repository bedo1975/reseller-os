import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/virtual-tryon-models
 * Admin — list all virtual try-on models (mannequins).
 * Public variant: GET ?active=true returns only active models (for the boutique storefront).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('active') === 'true'

    // Public endpoint: no auth needed for the boutique storefront
    if (!activeOnly) {
      try {
        await requireAuth()
      } catch {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }
    }

    const models = await db.virtualTryOnModel.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ models })
  } catch (error) {
    console.error('GET /api/virtual-tryon-models error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/virtual-tryon-models
 * Admin — create a new virtual try-on model.
 * Body: { name, gender, imageUrl, isActive?, order? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { name, gender, imageUrl, isActive, order } = body

    if (!name || !imageUrl) {
      return NextResponse.json({ error: 'Nom et image requis' }, { status: 400 })
    }

    const validGenders = ['homme', 'femme', 'enfant', 'autre']
    const finalGender = validGenders.includes(gender) ? gender : 'autre'

    const model = await db.virtualTryOnModel.create({
      data: {
        name: String(name).trim(),
        gender: finalGender,
        imageUrl: String(imageUrl),
        isActive: isActive !== false,
        order: typeof order === 'number' ? order : 0,
        defaultPrompt: typeof body.defaultPrompt === 'string' ? body.defaultPrompt.trim() || null : null,
        userId: user.id,
      },
    })

    return NextResponse.json(model)
  } catch (error) {
    console.error('POST /api/virtual-tryon-models error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
