import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueCategories } from '@/lib/boutique-settings'

// Force dynamic — never cache this route
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

// Get the base URL from env or fallback
function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

export async function GET() {
  const baseUrl = getBaseUrl()
  const now = new Date()
  const urls: string[] = []

  // ─── Static boutique pages ──────────────────────────────────────────────
  const staticPages: Array<{ url: string; priority: number; changeFreq: string }> = [
    { url: '/boutique', priority: 1.0, changeFreq: 'daily' },
    { url: '/boutique/contact', priority: 0.6, changeFreq: 'monthly' },
    { url: '/boutique/cgv', priority: 0.3, changeFreq: 'yearly' },
    { url: '/boutique/mentions-legales', priority: 0.3, changeFreq: 'yearly' },
    { url: '/boutique/connexion', priority: 0.4, changeFreq: 'monthly' },
    { url: '/boutique/panier', priority: 0.4, changeFreq: 'monthly' },
    { url: '/boutique/paiement-securise', priority: 0.5, changeFreq: 'monthly' },
    { url: '/boutique/livraison-rapide', priority: 0.5, changeFreq: 'monthly' },
    { url: '/boutique/retours-14-jours', priority: 0.5, changeFreq: 'monthly' },
  ]

  for (const p of staticPages) {
    urls.push(`  <url>
    <loc>${escapeXml(baseUrl + p.url)}</loc>
    <lastmod>${now.toISOString()}</lastmod>
    <changefreq>${p.changeFreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`)
  }

  // ─── Category pages (top-level only) ────────────────────────────────────
  try {
    const allCats = await getBoutiqueCategories()
    const topCats = allCats.filter((c: any) => !c.parentId)
    for (const cat of topCats) {
      const updatedAt = cat.updatedAt || now
      urls.push(`  <url>
    <loc>${escapeXml(baseUrl + '/boutique/categorie/' + cat.slug)}</loc>
    <lastmod>${updatedAt instanceof Date ? updatedAt.toISOString() : now.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
    }
  } catch (error) {
    console.error('Sitemap: failed to fetch categories:', error)
  }

  // ─── Product pages (PUBLIE + suggestedPrice > 0) ────────────────────────
  try {
    const products = await db.stockItem.findMany({
      where: {
        status: 'PUBLIE',
        suggestedPrice: { gt: 0 },
      },
      select: {
        sku: true,
        updatedAt: true,
      },
    })

    for (const p of products) {
      const updatedAt = p.updatedAt || now
      urls.push(`  <url>
    <loc>${escapeXml(baseUrl + '/boutique/produit/' + p.sku)}</loc>
    <lastmod>${updatedAt instanceof Date ? updatedAt.toISOString() : now.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
    }
  } catch (error) {
    console.error('Sitemap: failed to fetch products:', error)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  // Return with explicit no-cache headers so browsers and CDNs always fetch fresh
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Sitemap-Generated': now.toISOString(),
    },
  })
}
