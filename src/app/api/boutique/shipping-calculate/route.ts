import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/shipping-calculate
 * Public — calculates shipping cost based on total weight and shipping method.
 *
 * Body: {
 *   shippingMethodCode: string,
 *   items: [{ sku, qty }]  // ou
 *   totalWeight: number    // en grammes
 * }
 *
 * Returns: { shippingCost, weightRules: [...], totalWeight, method }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shippingMethodCode, items, totalWeight } = body

    if (!shippingMethodCode) {
      return NextResponse.json({ error: 'Code de livraison requis' }, { status: 400 })
    }

    // Find the shipping method
    const method = await db.shippingMethod.findUnique({
      where: { code: shippingMethodCode },
      include: { weightRules: { orderBy: { weightMin: 'asc' } } },
    })
    if (!method) {
      return NextResponse.json({ error: 'Mode de livraison introuvable' }, { status: 404 })
    }

    // Calculate total weight
    let weight = 0
    if (typeof totalWeight === 'number') {
      weight = totalWeight
    } else if (items && Array.isArray(items)) {
      // Fetch each item's weight from DB
      for (const item of items) {
        const stockItem = await db.stockItem.findFirst({
          where: { sku: item.sku },
          select: { weight: true },
        })
        const itemWeight = stockItem?.weight || 0
        weight += itemWeight * (item.qty || 1)
      }
    }

    // Default: items without weight = 500g each
    if (weight === 0 && items && Array.isArray(items) && items.length > 0) {
      weight = items.reduce((s: number, i: any) => s + 500 * (i.qty || 1), 0)
    }

    // Calculate shipping cost based on weight rules
    let shippingCost = method.price  // default base price
    if (method.weightRules.length > 0) {
      // Find the matching weight rule
      const rule = method.weightRules.find(r => weight >= r.weightMin && weight <= r.weightMax)
      if (rule) {
        shippingCost = rule.price
      } else {
        // If no rule matches, find the highest range
        const highestRule = method.weightRules[method.weightRules.length - 1]
        if (highestRule && weight > highestRule.weightMax) {
          shippingCost = highestRule.price
        }
      }
    }

    return NextResponse.json({
      shippingCost: parseFloat(shippingCost.toFixed(2)),
      totalWeight: weight,
      method: { code: method.code, label: method.label, delay: method.delay },
      weightRules: method.weightRules.map(r => ({
        weightMin: r.weightMin,
        weightMax: r.weightMax,
        price: r.price,
      })),
    })
  } catch (error) {
    console.error('POST /api/boutique/shipping-calculate error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
