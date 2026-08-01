const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // 1. Count all purchases
  const totalPurchases = await db.purchase.count()
  console.log(`Total purchases in DB: ${totalPurchases}`)

  // 2. Show all purchases (recent first)
  const purchases = await db.purchase.findMany({
    orderBy: { date: 'desc' },
    take: 10,
    include: { supplier: true },
  })
  console.log(`\nLast 10 purchases:`)
  purchases.forEach(p => {
    console.log(`  - id: ${p.id}`)
    console.log(`    designation: ${p.designation}`)
    console.log(`    amount: ${p.amount}`)
    console.log(`    date: ${p.date.toISOString()}`)
    console.log(`    category: ${p.category}`)
    console.log(`    userId: ${p.userId}`)
    console.log(`    supplierId: ${p.supplierId}`)
    console.log(`    supplierName: ${p.supplierName}`)
    console.log('')
  })

  // 3. Find the admin user
  const admin = await db.user.findFirst({ where: { role: 'admin' } })
  console.log(`Admin user: ${admin ? admin.id + ' (' + admin.email + ')' : 'NOT FOUND'}`)

  // 4. Test the exact query the accounting API uses
  const year = new Date().getFullYear()
  const dateFilter = {
    gte: new Date(`${year}-01-01T00:00:00.000Z`),
    lte: new Date(`${year}-12-31T23:59:59.999Z`),
  }
  console.log(`\nTesting accounting query for year ${year} with admin filter:`)
  console.log(`  dateFilter:`, dateFilter)
  
  const adminPurchases = await db.purchase.findMany({
    where: {
      date: dateFilter,
      userId: admin?.id || 'no-admin',
    },
    include: { supplier: true },
    orderBy: { date: 'asc' },
  })
  console.log(`  Found ${adminPurchases.length} purchases for admin in ${year}`)
  adminPurchases.forEach(p => {
    console.log(`    - ${p.designation}: ${p.amount}€ (${p.date.toISOString()})`)
  })

  // 5. Also test WITHOUT the userId filter to see if purchases exist but are owned by someone else
  const allYearPurchases = await db.purchase.findMany({
    where: { date: dateFilter },
    include: { supplier: true },
  })
  console.log(`\nAll purchases in ${year} (no userId filter): ${allYearPurchases.length}`)
  allYearPurchases.forEach(p => {
    console.log(`  - ${p.designation}: ${p.amount}€ | userId=${p.userId}`)
  })

  // 6. Count preorders
  const preorderCount = await db.preOrder.count()
  console.log(`\nTotal preorders: ${preorderCount}`)
  const validatedPreorders = await db.preOrder.findMany({
    where: { status: 'validated' },
    include: { supplier: true },
  })
  console.log(`Validated preorders: ${validatedPreorders.length}`)
  validatedPreorders.forEach(po => {
    console.log(`  - ${po.reference}: ${po.name} | total=${po.total}€ | purchaseId=${po.purchaseId || 'null'} | validatedAt=${po.validatedAt?.toISOString() || 'null'}`)
  })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
