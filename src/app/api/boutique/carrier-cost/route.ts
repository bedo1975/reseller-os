import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/carrier-cost
 * Public — returns the REAL carrier cost (what the shop pays the carrier) for a given order.
 *
 * Body: {
 *   carrierCode: string,  // e.g. "mondial_relay"
 *   weight: number,       // total weight in grams
 * }
 *
 * Returns: { carrierCost: number, rule: { ... } | null }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { carrierCode, weight } = body

    if (!carrierCode || typeof carrierCode !== 'string') {
      return NextResponse.json({ error: 'Transporteur requis' }, { status: 400 })
    }

    const totalWeight = parseFloat(weight) || 0

    // Find the matching pricing rule for this carrier and weight
    const rules = await db.carrierPricingRule.findMany({
      where: { carrierCode, active: true },
      orderBy: { weightMin: 'asc' },
    })

    if (rules.length === 0) {
      return NextResponse.json({
        carrierCost: 0,
        rule: null,
        warning: `Aucune tarification configurée pour le transporteur "${carrierCode}". Coût = 0.`,
      })
    }

    // Find the rule that matches the weight
    const matchingRule = rules.find(r => totalWeight >= r.weightMin && totalWeight <= r.weightMax)

    let rule
    if (matchingRule) {
      rule = matchingRule
    } else {
      // If weight > max weight, use the highest tier
      const highest = rules[rules.length - 1]
      if (totalWeight > highest.weightMax) {
        rule = highest
      } else {
        // Fallback (shouldn't happen if weight is reasonable)
        rule = rules[0]
      }
    }

    return NextResponse.json({
      carrierCost: rule.price,
      rule: {
        id: rule.id,
        label: rule.label,
        weightMin: rule.weightMin,
        weightMax: rule.weightMax,
        price: rule.price,
      },
    })
  } catch (error) {
    console.error('POST /api/boutique/carrier-cost error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
