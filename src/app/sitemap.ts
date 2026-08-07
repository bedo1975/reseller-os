import { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { getBoutiqueCategories } from '@/lib/boutique-settings'

// Force dynamic rendering — sitemap is regenerated on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Get the base URL from env or fallback
function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  }
  // Fallbacks for different environments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  // ─── Static boutique pages ──────────────────────────────────────────────
  const staticPages = [
    { url: '/', priority: 1.0, changeFreq: 'daily' as const },
    { url: '/contact', priority: 0.6, changeFreq: 'monthly' as const },
    { url: '/cgv', priority: 0.3, changeFreq: 'yearly' as const },
    { url: '/connexion', priority: 0.4, changeFreq: 'monthly' as const },
    { url: '/panier', priority: 0.4, changeFreq: 'monthly' as const },
    { url: '/paiement-securise', priority: 0.5, changeFreq: 'monthly' as const },
    { url: '/livraison-rapide', priority: 0.5, changeFreq: 'monthly' as const },
    { url: '/retours-14-jours', priority: 0.5, changeFreq: 'monthly' as const },
  ]

  for (const p of staticPages) {
    entries.push({
      url: `${baseUrl}${p.url}`,
      lastModified: now,
      changeFrequency: p.changeFreq,
      priority: p.priority,
    })
  }

  // ─── Category pages ─────────────────────────────────────────────────────
  try {
    const categories = await getBoutiqueCategories()
    for (const cat of categories) {
      entries.push({
        url: `${baseUrl}/categorie/${cat.slug}`,
        lastModified: (cat as any).updatedAt || now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
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
      entries.push({
        url: `${baseUrl}/produit/${p.sku}`,
        lastModified: p.updatedAt || now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  } catch (error) {
    console.error('Sitemap: failed to fetch products:', error)
  }

  return entries
}
