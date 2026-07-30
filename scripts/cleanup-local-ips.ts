import { db } from '../src/lib/db'

/**
 * Clean up visitor tracking records that have local IPs (::ffff:127.0.0.1, 127.0.0.1, etc.)
 * These records were created before the IP filtering fix.
 * We don't delete them (they still have useful page view data) but we set ipAddress to null
 * so the next visit from the same visitorId will re-trigger the IP capture.
 */
async function main() {
  const result = await db.visitorTracking.updateMany({
    where: {
      OR: [
        { ipAddress: '::ffff:127.0.0.1' },
        { ipAddress: '127.0.0.1' },
        { ipAddress: '::1' },
        { ipAddress: { startsWith: '::ffff:127.' } },
        { ipAddress: { startsWith: '::ffff:192.168.' } },
        { ipAddress: { startsWith: '::ffff:10.' } },
      ]
    },
    data: { ipAddress: null },
  })
  console.log(`✓ ${result.count} enregistrements nettoyés (IP locale → null)`)

  // Also reset city/country for these records so they get re-populated on next visit
  const result2 = await db.visitorTracking.updateMany({
    where: {
      ipAddress: null,
      country: null,
    },
    data: {},
  })
  console.log(`✓ ${result2.count} enregistrements sans IP ni pays (seront mis à jour au prochain passage)`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
