import { db } from '../src/lib/db'

/**
 * Recalcule le profit et la marge de toutes les ventes existantes avec la nouvelle formule :
 *   CA = salePrice + shippingCost (frais port client)
 *   profit = CA - purchaseCost - platformFees - platformFixedFees - carrierShippingCost
 *   margin = (profit / CA) * 100
 *
 * NB : l'URSSAF et les autres dépenses sont déduits au niveau fiscalité agrégée, pas par vente.
 */
async function main() {
  const sales = await db.sale.findMany({ include: { stockItem: true } })
  let updated = 0

  for (const sale of sales) {
    const purchaseCost = sale.stockItem?.purchaseCost || 0
    const ca = sale.salePrice + (sale.shippingCost || 0)
    const totalFees = (sale.platformFees || 0) + (sale.platformFixedFees || 0) + (sale.carrierShippingCost || 0)
    const profit = parseFloat((ca - purchaseCost - totalFees).toFixed(2))
    const margin = parseFloat((ca > 0 ? (profit / ca) * 100 : 0).toFixed(1))

    if (sale.profit !== profit || sale.margin !== margin) {
      await db.sale.update({
        where: { id: sale.id },
        data: { profit, margin },
      })
      updated++
      console.log(`  ${sale.invoiceNumber || sale.id}: CA=${ca.toFixed(2)} profit ${sale.profit}→${profit} margin ${sale.margin}→${margin}`)
    }
  }

  console.log(`✓ ${updated} ventes recalculées sur ${sales.length} total`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
