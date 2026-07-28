import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/session'

export async function GET() {
  try {
    // All authenticated users can READ settings (shared attributes)
    await requireAuth()
    const attrs = await db.attribute.findMany({ orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] })
    return NextResponse.json(attrs)
  } catch (error) {
    console.error('GET /api/settings error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { type, value, code, isDefault, trackingUrl, parentCode, fixedFees, percentFees } = body

    if (!type || !value || !code) {
      return NextResponse.json({ error: 'Type, valeur et code requis' }, { status: 400 })
    }

    // Si isDefault=true, on retire le défaut des autres attrs du même type
    if (isDefault) {
      await db.attribute.updateMany({
        where: { type },
        data: { isDefault: false },
      })
    }

    const sortOrder = await db.attribute.count({ where: { type } })

    const attr = await db.attribute.create({
      data: {
        type,
        value: value.trim(),
        code: code.trim(),
        isDefault: !!isDefault,
        trackingUrl: trackingUrl || null,
        parentCode: parentCode || null,
        fixedFees: parseFloat(fixedFees) || 0,
        percentFees: parseFloat(percentFees) || 0,
        sortOrder,
      },
    })

    return NextResponse.json(attr)
  } catch (error) {
    console.error('POST /api/settings error:', error)
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { id, value, code, isDefault, sortOrder, trackingUrl, parentCode, fixedFees, percentFees } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await db.attribute.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Attribut introuvable' }, { status: 404 })
    }

    if (isDefault) {
      await db.attribute.updateMany({
        where: { type: existing.type },
        data: { isDefault: false },
      })
    }

    const attr = await db.attribute.update({
      where: { id },
      data: {
        ...(value !== undefined && { value: value.trim() }),
        ...(code !== undefined && { code: code.trim() }),
        ...(isDefault !== undefined && { isDefault: !!isDefault }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
        ...(trackingUrl !== undefined && { trackingUrl: trackingUrl || null }),
        ...(parentCode !== undefined && { parentCode: parentCode || null }),
        ...(fixedFees !== undefined && { fixedFees: parseFloat(fixedFees) || 0 }),
        ...(percentFees !== undefined && { percentFees: parseFloat(percentFees) || 0 }),
      },
    })

    return NextResponse.json(attr)
  } catch (error) {
    console.error('PATCH /api/settings error:', error)
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
