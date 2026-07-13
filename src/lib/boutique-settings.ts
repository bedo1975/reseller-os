import { db } from '@/lib/db'

/**
 * Returns the BoutiqueSettings (single row, id='default').
 * Auto-creates with defaults if missing.
 */
export async function getBoutiqueSettings() {
  let settings = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })
  if (!settings) {
    settings = await db.boutiqueSettings.create({ data: { id: 'default' } })
  }
  return settings
}

/**
 * Returns active shipping methods, ordered.
 */
export async function getActiveShippingMethods() {
  return db.shippingMethod.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  })
}

/**
 * Returns boutique categories, ordered.
 * Falls back to default categories if DB is empty.
 */
export async function getBoutiqueCategories() {
  const cats = await db.boutiqueCategory.findMany({
    orderBy: { order: 'asc' },
  })
  if (cats.length === 0) {
    // Return defaults (without persisting — admin can edit later)
    return [
      { slug: 'vetements', label: 'Vêtements', emoji: '👕', backgroundImage: null, order: 0 },
      { slug: 'chaussures', label: 'Chaussures', emoji: '👟', backgroundImage: null, order: 1 },
      { slug: 'accessoires', label: 'Accessoires', emoji: '👜', backgroundImage: null, order: 2 },
      { slug: 'luxe', label: 'Luxe', emoji: '💎', backgroundImage: null, order: 3 },
      { slug: 'maison', label: 'Maison', emoji: '🏠', backgroundImage: null, order: 4 },
    ]
  }
  return cats
}
