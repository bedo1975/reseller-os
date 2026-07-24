import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// PATCH — admin only (partial update of a category)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin()
    const { slug } = await params
    const body = await req.json()

    const data: any = {}
    if (typeof body.label === 'string') data.label = body.label.trim()
    if (typeof body.emoji === 'string') data.emoji = body.emoji.trim() || '📦'
    if (body.backgroundImage !== undefined) data.backgroundImage = body.backgroundImage || null
    if (typeof body.order === 'number' || typeof body.order === 'string') data.order = parseInt(body.order) || 0
    if (body.parentId !== undefined) data.parentId = body.parentId || null
    if (typeof body.filtersJson === 'string') data.filtersJson = body.filtersJson

    // bgColor (hex 6 chars without #)
    if (body.bgColor !== undefined) {
      if (typeof body.bgColor === 'string' && body.bgColor.trim()) {
        const cleaned = body.bgColor.trim().replace(/^#/, '')
        if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
          return NextResponse.json({ error: 'bgColor doit être un hex 6 caractères' }, { status: 400 })
        }
        data.bgColor = cleaned
      } else {
        data.bgColor = null
      }
    }

    // bgOpacity (0 to 1)
    if (body.bgOpacity !== undefined && body.bgOpacity !== null) {
      const parsed = typeof body.bgOpacity === 'string' ? parseFloat(body.bgOpacity) : body.bgOpacity
      if (isNaN(parsed) || parsed < 0 || parsed > 1) {
        return NextResponse.json({ error: 'bgOpacity doit être entre 0 et 1' }, { status: 400 })
      }
      data.bgOpacity = parsed
    }

    // Use upsert instead of update — if the category doesn't exist yet (e.g., it's a default fallback
    // from getBoutiqueCategories() that hasn't been persisted), we create it on first save.
    // We need full data for the create branch, so we build a complete object with sensible defaults.
    const createData: any = {
      slug,
      label: data.label ?? slug,
      emoji: data.emoji ?? '📦',
      backgroundImage: data.backgroundImage ?? null,
      bgColor: data.bgColor ?? null,
      bgOpacity: data.bgOpacity ?? 0.5,
      order: data.order ?? 0,
    }

    const category = await db.boutiqueCategory.upsert({
      where: { slug },
      update: data,
      create: createData,
    })

    // Invalidate sitemap + boutique pages — categories appear in the sitemap
    // and on the boutique homepage (the category cards)
    try {
      revalidatePath('/sitemap.xml')
      revalidatePath('/boutique')
      // Also revalidate the category page itself in case the label/emoji changed
      revalidatePath(`/boutique/categorie/${slug}`)
      revalidatePath('/boutique/categorie/[cat]', 'page')
    } catch (e) {
      console.error('[sitemap] revalidatePath failed:', e)
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('PATCH /api/boutique/admin/categories/[slug] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin()
    const { slug } = await params
    // Try to delete; if the record doesn't exist (e.g., it was a default fallback),
    // we just return ok — the category won't appear anymore once other persisted ones exist.
    try {
      await db.boutiqueCategory.delete({ where: { slug } })
    } catch (e: any) {
      if (e?.code !== 'P2025') throw e
    }

    // Invalidate sitemap + boutique homepage — the deleted category should disappear
    try {
      revalidatePath('/sitemap.xml')
      revalidatePath('/boutique')
      revalidatePath(`/boutique/categorie/${slug}`)
      revalidatePath('/boutique/categorie/[cat]', 'page')
    } catch (e) {
      console.error('[sitemap] revalidatePath failed:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/categories/[slug] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
