import { db } from '../src/lib/db'

async function main() {
  const items = await db.stockItem.findMany({ include: { sales: true } })
  let updated = 0
  for (const item of items) {
    const realSoldCount = item.sales.length
    if (item.soldCount !== realSoldCount) {
      await db.stockItem.update({
        where: { id: item.id },
        data: { soldCount: realSoldCount },
      })
      updated++
      console.log(`  ${item.sku}: soldCount ${item.soldCount} → ${realSoldCount}`)
    }
  }
  console.log(`✓ ${updated} items mis à jour sur ${items.length} total`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
