import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { vintedFetch, buildCatalogUrl } from '@/lib/vinted'

export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || 'nike'

    const data = await vintedFetch(
      buildCatalogUrl({ search_text: q, per_page: 96 }),
    )
    if (data.error) {
      return NextResponse.json({ error: data.error, sizes: [] })
    }

    const seen: Record<string, boolean> = {}
    const sizes: { title: string }[] = []
    ;(data.items || []).forEach((item: any) => {
      const t = item.size_title
      if (t && !seen[t]) {
        seen[t] = true
        sizes.push({ title: t })
      }
    })
    sizes.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))

    return NextResponse.json({ sizes })
  } catch (error) {
    console.error('GET /api/vinted/sizes error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
