import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { getBoutiqueCategories } from '@/lib/boutique-settings'
import { revalidatePath } from 'next/cache'

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
    const { slug, label, emoji, backgroundImage, bgColor, bgOpacity, order } = body

    if (!slug || !label) {
      return NextResponse.json({ error: 'Slug et libellé requis' }, { status: 400 })
    }

    // Validate bgColor (hex without #) if provided
    let normalizedBgColor: string | null = null
    if (typeof bgColor === 'string' && bgColor.trim()) {
      const cleaned = bgColor.trim().replace(/^#/, '')
      if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        return NextResponse.json({ error: 'bgColor doit être un hex 6 caractères (ex: 007bff)' }, { status: 400 })
      }
      normalizedBgColor = cleaned
    }

    // Validate bgOpacity (0.0 to 1.0)
    let normalizedOpacity: number | undefined = undefined
    if (bgOpacity !== undefined && bgOpacity !== null) {
      const parsed = typeof bgOpacity === 'string' ? parseFloat(bgOpacity) : bgOpacity
      if (isNaN(parsed) || parsed < 0 || parsed > 1) {
        return NextResponse.json({ error: 'bgOpacity doit être un nombre entre 0 et 1' }, { status: 400 })
      }
      normalizedOpacity = parsed
    }

    const data: any = {
      label: label.trim(),
      emoji: emoji?.trim() || '📦',
      backgroundImage: backgroundImage || null,
      bgColor: normalizedBgColor,
      order: parseInt(order) || 0,
      parentId: body.parentId || null,
      filtersJson: typeof body.filtersJson === 'string' ? body.filtersJson : '[]',
    }
    if (normalizedOpacity !== undefined) {
      data.bgOpacity = normalizedOpacity
    }

    const category = await db.boutiqueCategory.upsert({
      where: { slug: slug.trim() },
      create: {
        slug: slug.trim(),
        ...data,
      },
      update: data,
    })

    // Invalidate sitemap + boutique homepage — new/updated category should appear
    try {
      revalidatePath('/sitemap.xml')
      revalidatePath('/boutique')
      revalidatePath(`/boutique/categorie/${slug.trim()}`)
      revalidatePath('/boutique/categorie/[cat]', 'page')
    } catch (e) {
      console.error('[sitemap] revalidatePath failed:', e)
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('POST /api/boutique/admin/categories error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
