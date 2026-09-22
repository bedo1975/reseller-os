import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const SITE_URL = 'https://junashop.fr'
const SITE_NAME = 'JunaShop'

// Catégories internes → taxonomie Google Shopping
const GOOGLE_CATEGORIES: Record<string, string> = {
  vetements: 'Apparel & Accessories > Clothing',
  chaussures: 'Apparel & Accessories > Shoes',
  accessoires: 'Apparel & Accessories > Clothing Accessories',
  luxe: 'Apparel & Accessories > Clothing',
  maison: 'Home & Garden',
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Google refuse le HTML dans les descriptions — on le retire
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// Les photos internes sont relatives (/api/uploads/...) → absolues
function absoluteUrl(u: string): string {
  return u.startsWith('http') ? u : `${SITE_URL}${u}`
}

export async function GET() {
  try {
    const items = await db.stockItem.findMany({
      where: {
        status: 'PUBLIE',
        stockType: 'boutique',
        quantity: { gt: 0 },
        suggestedPrice: { gt: 0 },
      },
      select: {
        sku: true, title: true, brand: true, category: true,
        size: true, color: true, condition: true, description: true,
        photos: true, suggestedPrice: true, salePrice: true, saleActive: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const itemsXml = items.map(item => {
      let photos: string[] = []
      try { photos = JSON.parse(item.photos) || [] } catch {}

      // Sans image → Google rejette l'article : on ne l'envoie pas
      if (photos.length === 0) return null

      const titleBase = [item.title || '', item.brand].filter(Boolean).join(' ')
      const title = [titleBase, item.size ? `Taille ${item.size}` : '', item.color || '']
        .filter(Boolean).join(' · ').slice(0, 150)

      const description = (stripHtml(item.description || '').slice(0, 5000)) ||
        `${item.brand} — ${titleBase}. Article de seconde main contrôlé, prêt à porter. Livraison rapide, retours 14 jours.`

      const condition = item.condition === 'neuf' ? 'new' : 'used'
      const onSale = item.saleActive === true && item.salePrice != null
        && item.salePrice < (item.suggestedPrice ?? 0)

      const additionalImages = photos.slice(1, 11).map(p =>
        `    <g:additional_image_link>${escapeXml(absoluteUrl(p))}</g:additional_image_link>`
      ).join('\n')

      return `  <item>
    <g:id>${escapeXml(item.sku)}</g:id>
    <g:title>${escapeXml(title)}</g:title>
    <g:description>${escapeXml(description)}</g:description>
    <g:link>${escapeXml(`${SITE_URL}/produit/${encodeURIComponent(item.sku)}`)}</g:link>
    <g:image_link>${escapeXml(absoluteUrl(photos[0]))}</g:image_link>
 ${additionalImages}
    <g:availability>in_stock</g:availability>
    <g:price>${(item.suggestedPrice ?? 0).toFixed(2)} EUR</g:price>
 ${onSale ? `    <g:sale_price>${(item.salePrice as number).toFixed(2)} EUR</g:sale_price>` : ''}
    <g:brand>${escapeXml(item.brand)}</g:brand>
    <g:condition>${condition}</g:condition>
 ${item.size ? `    <g:size>${escapeXml(item.size)}</g:size>` : ''}
 ${item.color ? `    <g:color>${escapeXml(item.color)}</g:color>` : ''}
    <g:google_product_category>${escapeXml(GOOGLE_CATEGORIES[item.category] || 'Apparel & Accessories')}</g:google_product_category>
    <g:identifier_exists>no</g:identifier_exists>
    <g:custom_label_0>seconde-main</g:custom_label_0>
  </item>`
    }).filter(i => i !== null).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${escapeXml(SITE_NAME)}</title>
  <link>${SITE_URL}</link>
  <description>Mode de seconde main contrôlée — vêtements, chaussures et accessoires.</description>
 ${itemsXml}
</channel>
</rss>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('GET /api/merchant-feed error:', error)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"></rss>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  }
}