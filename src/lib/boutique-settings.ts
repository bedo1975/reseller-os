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
 * Default categories — used to seed the DB on first access, and as a fallback
 * if the DB is empty. Persisting them ensures that editing one category
 * doesn't make the others disappear.
 */
const DEFAULT_CATEGORIES = [
  { slug: 'vetements', label: 'Vêtements', emoji: '👕', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 0 },
  { slug: 'chaussures', label: 'Chaussures', emoji: '👟', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 1 },
  { slug: 'accessoires', label: 'Accessoires', emoji: '👜', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 2 },
  { slug: 'luxe', label: 'Luxe', emoji: '💎', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 3 },
  { slug: 'maison', label: 'Maison', emoji: '🏠', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 4 },
]

/**
 * Returns boutique categories, ordered.
 * Auto-seeds the DB with defaults on first access so editing one category
 * doesn't make the others disappear.
 */
export async function getBoutiqueCategories() {
  let cats = await db.boutiqueCategory.findMany({
    orderBy: { order: 'asc' },
  })

  if (cats.length === 0) {
    // Persist the defaults — this ensures that when the admin edits one category,
    // the others remain visible (they're now real DB rows, not transient fallbacks).
    try {
      await db.boutiqueCategory.createMany({
        data: DEFAULT_CATEGORIES.map(({ slug, label, emoji, backgroundImage, bgColor, bgOpacity, order }) => ({
          slug, label, emoji, backgroundImage, bgColor, bgOpacity, order,
        })),
      })
      cats = await db.boutiqueCategory.findMany({ orderBy: { order: 'asc' } })
    } catch (e) {
      console.error('[getBoutiqueCategories] failed to seed defaults:', e)
      // Fallback to transient defaults if seeding fails
      return DEFAULT_CATEGORIES
    }
  }

  return cats
}
