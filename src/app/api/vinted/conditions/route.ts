import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { vintedFetch, STATUS_MAP } from '@/lib/vinted'

// In-memory cache (1 hour) — statuses rarely change
let cache: { data: any; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

const FALLBACK_TITLES: Record<string, string> = {
  new_with_tags: 'Neuve avec étiquette',
  new_without_tags: 'Neuve sans étiquette',
  very_good: 'Très bon état',
  good: 'Bon état',
  satisfactory: 'Satisfaisant',
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export async function GET() {
  try {
    await requireAuth()

    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const DOMAIN = process.env.VINTED_DOMAIN || 'https://www.vinted.fr'
    const data = await vintedFetch(`${DOMAIN}/api/v2/statuses`)

    let statuses: { id: number; title: string; key: string }[] = []

    if (!data.error) {
      // Vinted returns { statuses: [...] } — handle various shapes defensively
      const raw: any[] =
        data.statuses || data.catalog_statuses || (Array.isArray(data) ? data : [])
      statuses = raw
        .filter((s: any) => s && s.id != null && (s.title || s.name))
        .map((s: any) => ({
          id: Number(s.id),
          title: s.title || s.name,
          key: s.icon || s.slug || slugify(s.title || s.name),
        }))
    }

    // Fallback to hardcoded map if API failed or returned nothing
    if (statuses.length === 0) {
      statuses = Object.entries(STATUS_MAP).map(([key, id]) => ({
        id,
        title: FALLBACK_TITLES[key] || key,
        key,
      }))
    }

    const result = { statuses }
    cache = { data: result, ts: Date.now() }
    return NextResponse.json(result)
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

