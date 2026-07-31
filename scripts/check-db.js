const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // Check the schema
  const cols = await db.$queryRaw`SELECT name, type FROM pragma_table_info('BoutiqueClient')`
  console.log('Columns in BoutiqueClient:')
  cols.forEach(c => console.log(`  ${c.name} (${c.type})`))

  // Count clients
  const count = await db.boutiqueClient.count()
  console.log(`\nTotal clients: ${count}`)

  // Show unvalidated clients
  const unvalidated = await db.boutiqueClient.findMany({
    where: { emailValidated: false },
    select: { id: true, email: true, emailValidated: true, validationToken: true, createdAt: true },
    take: 5,
  })
  console.log(`\nUnvalidated clients (first 5):`)
  unvalidated.forEach(c => {
    console.log(`  - ${c.email}`)
    console.log(`    emailValidated: ${c.emailValidated}`)
    console.log(`    validationToken: ${c.validationToken ? c.validationToken.substring(0, 16) + '...' : 'null'}`)
    console.log(`    createdAt: ${c.createdAt.toISOString()}`)
  })

  // Test: can we find a client by validationToken?
  if (unvalidated.length > 0) {
    const testToken = unvalidated[0].validationToken
    console.log(`\nTest: searching by validationToken "${testToken.substring(0, 16)}..."`)
    const found = await db.boutiqueClient.findFirst({
      where: { validationToken: testToken },
    })
    console.log(`  Found: ${found ? found.email : 'null'}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
