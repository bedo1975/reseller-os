import { db } from '../src/lib/db'

/**
 * Recalcule le profit de toutes les ventes existantes en incluant les paymentFees (frais bancaires).
 * Comme le champ paymentFees vient juste d'être ajouté, les ventes existantes ont paymentFees = 0.
 * On recalcule juste le profit avec la nouvelle formule (qui inclut paymentFees dans la soustraction).
 *
 * Formule :
 *   CA brut = salePrice + shippingCost
 *   profit = CA brut - paymentFees - purchaseCost - platformFees - platformFixedFees - carrierShippingCost
 *   margin = (profit / CA brut) × 100
 */
async function main() {
  const sales = await db.sale.findMany({ include: { stockItem: true } })
  let updated = 0

  for (const sale of sales) {
    const purchaseCost = sale.stockItem?.purchaseCost || 0
    const ca = sale.salePrice + (sale.shippingCost || 0)
    const totalFees = (sale.paymentFees || 0) + (sale.platformFees || 0) + (sale.platformFixedFees || 0) + (sale.carrierShippingCost || 0)
    const profit = parseFloat((ca - totalFees - purchaseCost).toFixed(2))
    const margin = parseFloat((ca > 0 ? (profit / ca) * 100 : 0).toFixed(1))

    if (sale.profit !== profit || sale.margin !== margin) {
      await db.sale.update({
        where: { id: sale.id },
        data: { profit, margin },
      })
      updated++
    }
  }

  console.log(`✓ ${updated} ventes recalculées sur ${sales.length} total`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
