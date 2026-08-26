import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

/**
 * GET /api/boutique/offers/config
 * Public — returns the Make an Offer configuration for the storefront.
 * Used by the product page to display the offer form.
 */
export async function GET() {
  try {
    const bs = await getBoutiqueSettings()
    let discounts: number[] = [1, 2, 3]
    try {
      const parsed = JSON.parse(bs.makeOfferDiscounts || '[1,2,3]')
      if (Array.isArray(parsed)) {
        discounts = parsed
          .map((v: any) => Number(v))
          .filter(v => !Number.isNaN(v) && v > 0)
          .sort((a, b) => a - b)
      }
    } catch {}
    return NextResponse.json({
      discounts,
      allowFreeOffer: bs.makeOfferAllowFreeOffer,
      cartDurationHours: bs.makeOfferCartDurationHours || 24,
    })
  } catch (error) {
    console.error('GET /api/boutique/offers/config error:', error)
    return NextResponse.json({ discounts: [1, 2, 3], allowFreeOffer: true, cartDurationHours: 24 }, { status: 500 })
  }
}
