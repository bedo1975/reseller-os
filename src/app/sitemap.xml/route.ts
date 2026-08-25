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
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
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
    { url: '/', priority: 1.0, changeFreq: 'daily' },
    { url: '/contact', priority: 0.6, changeFreq: 'monthly' },
    { url: '/cgv', priority: 0.3, changeFreq: 'yearly' },
    { url: '/mentions-legales', priority: 0.3, changeFreq: 'yearly' },
    { url: '/connexion', priority: 0.4, changeFreq: 'monthly' },
    { url: '/panier', priority: 0.4, changeFreq: 'monthly' },
    { url: '/paiement-securise', priority: 0.5, changeFreq: 'monthly' },
    { url: '/livraison-rapide', priority: 0.5, changeFreq: 'monthly' },
    { url: '/retours-14-jours', priority: 0.5, changeFreq: 'monthly' },
    { url: '/grade', priority: 0.5, changeFreq: 'monthly' },
  ]

  for (const p of staticPages) {
    urls.push(`  <url>
    <loc>${escapeXml(baseUrl + p.url)}</loc>
    <lastmod>${now.toISOString()}</lastmod>
    <changefreq>${p.changeFreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`)
  }

  // ─── Category pages (top-level + subcategories) ────────────────────────────
  try {
    const allCats = await getBoutiqueCategories()
    for (const cat of allCats) {
      const updatedAt = (cat as any).updatedAt || now
      const url = cat.parentId
        ? `${baseUrl}/categorie/${cat.parentId}?subcat=${cat.slug}`
        : `${baseUrl}/categorie/${cat.slug}`
      urls.push(`  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${updatedAt instanceof Date ? updatedAt.toISOString() : now.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`)
    }
  } catch (error) {
    console.error('Sitemap: failed to fetch categories:', error)
  }

  // ─── Product pages with rich metadata (title, description, images) ─────────
  // This generates a Google-compatible sitemap with <image:image> tags so
  // Google Images can index the product photos and link them to the product page.
  try {
    const products = await db.stockItem.findMany({
      where: {
        status: 'PUBLIE',
        // Only boutique-type items are listed on the online store
        stockType: 'boutique',
        suggestedPrice: { gt: 0 },
      },
      select: {
        sku: true,
        brand: true,
        title: true,
        category: true,
        description: true,
        photos: true,
        updatedAt: true,
        condition: true,
        size: true,
        color: true,
        suggestedPrice: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    for (const p of products) {
      const updatedAt = p.updatedAt || now
      const productUrl = `${baseUrl}/produit/${p.sku}`

      // Build a rich title: "Marque Titre - Taille Couleur | Junashop"
      const titleParts = [
        p.brand,
        p.title,
        p.size && `Taille ${p.size}`,
        p.color,
      ].filter(Boolean).join(' - ')

      // Build a description snippet (first 300 chars, strip HTML)
      let descriptionSnippet = ''
      if (p.description) {
        // Strip HTML tags for the sitemap (Google doesn't parse HTML in sitemaps)
        descriptionSnippet = p.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300)
      }
      if (!descriptionSnippet) {
        // Fallback: build a description from product attributes
        descriptionSnippet = [
          p.brand,
          p.title,
          p.category,
          p.condition && `État: ${p.condition}`,
          p.size && `Taille: ${p.size}`,
          p.color && `Couleur: ${p.color}`,
          p.suggestedPrice && `Prix: ${parseFloat(p.suggestedPrice.toString()).toFixed(2)} €`,
        ].filter(Boolean).join(' - ')
      }

      // Parse photos and build <image:image> entries
      let imageTags = ''
      try {
        const photos: string[] = JSON.parse(p.photos || '[]')
        // Google allows up to 1000 images per URL, but we'll limit to 5 for performance
        for (const photo of photos.slice(0, 5)) {
          // Convert relative URLs to absolute
          const photoUrl = photo.startsWith('http')
            ? photo
            : photo.startsWith('/api/uploads/')
              ? `${baseUrl}${photo}`
              : photo.startsWith('/uploads/')
                ? `${baseUrl}/api${photo}`
                : `${baseUrl}${photo}`

          // Image caption: product title + brand
          const caption = escapeXml(`${p.brand} ${p.title || p.category}`)
          // Image title: same as caption
          const imageTitle = caption

          imageTags += `
    <image:image>
      <image:loc>${escapeXml(photoUrl)}</image:loc>
      <image:caption>${caption}</image:caption>
      <image:title>${imageTitle}</image:title>
    </image:image>`
        }
      } catch {}

      urls.push(`  <url>
    <loc>${escapeXml(productUrl)}</loc>
    <lastmod>${updatedAt instanceof Date ? updatedAt.toISOString() : now.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTags}
  </url>`)
    }
  } catch (error) {
    console.error('Sitemap: failed to fetch products:', error)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
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
