import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'

/**
 * PATCH /api/virtual-tryon-models/[id]
 * Admin — update a virtual try-on model.
 * Body: { name?, gender?, imageUrl?, isActive?, order? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()

    const existing = await db.virtualTryOnModel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (typeof body.name === 'string') updateData.name = body.name.trim()
    if (typeof body.gender === 'string') {
      const validGenders = ['homme', 'femme', 'enfant', 'autre']
      if (validGenders.includes(body.gender)) updateData.gender = body.gender
    }
    if (typeof body.imageUrl === 'string') updateData.imageUrl = body.imageUrl
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive
    if (typeof body.order === 'number') updateData.order = body.order

    const model = await db.virtualTryOnModel.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(model)
  } catch (error) {
    console.error('PATCH /api/virtual-tryon-models/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/virtual-tryon-models/[id]
 * Admin — delete a virtual try-on model.
 * Also deletes the image file from disk (if it was uploaded via our upload endpoint).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const existing = await db.virtualTryOnModel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })
    }

    // Delete the image file from disk (best-effort — don't fail if file is missing)
    if (existing.imageUrl.startsWith('/uploads/models/')) {
      try {
        const fullPath = path.join(process.cwd(), 'public', existing.imageUrl.replace(/^\//, ''))
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      } catch (e) {
        console.error('[virtual-tryon-models] Failed to delete image file:', e)
      }
    }

    await db.virtualTryOnModel.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/virtual-tryon-models/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
