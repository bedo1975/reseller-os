import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

// POST /api/product-trends/search — scan marketplaces for trending products
// Body: { keyword, category?, platform?, country?, period?, priceMin?, priceMax? }
// Returns: { results: [{ title, image, price, url, platform, score }], summary: { totalResults, avgPrice, minPrice, maxPrice, medianPrice, topScore } }
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const {
      keyword,
      category,
      platform = 'all',
      country = 'fr',
      period = '30d',
      priceMin,
      priceMax,
    } = body

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
      return NextResponse.json({ error: 'Mot-clé requis (min 2 caractères)' }, { status: 400 })
    }

    const cleanKeyword = keyword.trim()
    const platforms = platform === 'all'
      ? ['vinted', 'ebay', 'etsy']
      : [platform]

    // Simulate scanning marketplaces — in production, this would call actual APIs
    // For now we generate realistic-looking results based on the keyword
    const allResults: any[] = []

    for (const p of platforms) {
      const count = p === 'vinted' ? 12 : p === 'ebay' ? 8 : 6
      for (let i = 0; i < count; i++) {
        const basePrice = p === 'vinted' ? 8 + Math.random() * 40 : p === 'ebay' ? 15 + Math.random() * 80 : 12 + Math.random() * 50
        const price = Math.round(basePrice * 100) / 100
        // Skip if outside price range
        if (priceMin && price < priceMin) continue
        if (priceMax && price > priceMax) continue

        const score = Math.floor(40 + Math.random() * 60) // 40-100
        allResults.push({
          title: generateTitle(cleanKeyword, p, i, category),
          image: `https://placehold.co/200x200/e5e7eb/6b7280?text=${encodeURIComponent(cleanKeyword.slice(0, 12))}`,
          price,
          url: generateUrl(p, country, cleanKeyword),
          platform: p,
          score,
          seller: generateSeller(p),
          location: country.toUpperCase(),
          postedDaysAgo: Math.floor(Math.random() * 30),
        })
      }
    }

    // Sort by score desc
    allResults.sort((a, b) => b.score - a.score)

    // Compute summary stats
    const prices = allResults.map(r => r.price).sort((a, b) => a - b)
    const avgPrice = prices.length > 0 ? Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100 : 0
    const minPrice = prices.length > 0 ? prices[0] : 0
    const maxPrice = prices.length > 0 ? prices[prices.length - 1] : 0
    const medianPrice = prices.length > 0
      ? Math.round((prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)]) * 100) / 100
      : 0
    const topScore = allResults.length > 0 ? allResults[0].score : 0

    // Compute trend score (0-100) based on result volume + avg price stability
    const volumeScore = Math.min(100, allResults.length * 3)
    const trendScore = Math.round((volumeScore + topScore) / 2)

    const summary = {
      totalResults: allResults.length,
      avgPrice,
      minPrice,
      maxPrice,
      medianPrice,
      topScore,
      trendScore,
      platforms: platforms,
      period,
      country,
    }

    return NextResponse.json({
      results: allResults,
      summary,
      searchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('POST /api/product-trends/search error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function generateTitle(keyword: string, platform: string, i: number, category?: string): string {
  const adjectives = ['Neuf', 'Très bon état', 'Bon état', 'Comme neuf', 'Parfait état', 'Premium', 'Vintage', 'Rare']
  const sizes = ['S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44', 'Unique']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const size = sizes[Math.floor(Math.random() * sizes.length)]
  const capKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1)

  if (i === 0) return `${capKeyword} — ${adj} ${size}`
  if (i === 1) return `${capKeyword} original ${size}`
  if (i === 2) return `${capKeyword} ${adj.toLowerCase()} ${size}`
  if (i % 3 === 0) return `${capKeyword} taille ${size} ${adj.toLowerCase()}`
  if (i % 3 === 1) return `${capKeyword} authentic ${size}`
  return `${capKeyword} ${adj} — ${size}`
}

function generateUrl(platform: string, country: string, keyword: string): string {
  const q = encodeURIComponent(keyword)
  switch (platform) {
    case 'vinted':
      return `https://www.vinted.${country === 'fr' ? 'fr' : country}/catalog?search_text=${q}`
    case 'ebay':
      return `https://www.ebay.${country === 'uk' ? 'co.uk' : country === 'us' ? 'com' : 'fr'}/sch/i.html?_nkw=${q}`
    case 'etsy':
      return `https://www.etsy.com/search?q=${q}`
    case 'leboncoin':
      return `https://www.leboncoin.fr/recherche?text=${q}`
    default:
      return '#'
  }
}

function generateSeller(platform: string): string {
  const prefixes = ['user_', 'shop_', 'pro_', 'particulier_']
  const nums = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${nums}`
}
