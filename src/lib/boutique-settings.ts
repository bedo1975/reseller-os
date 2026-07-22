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
 * Default categories — used to seed the DB on first access.
 * Top-level categories only (parentId = null).
 */
const DEFAULT_CATEGORIES = [
  { slug: 'vetements', label: 'Vêtements', emoji: '👕', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 0, parentId: null },
  { slug: 'chaussures', label: 'Chaussures', emoji: '👟', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 1, parentId: null },
  { slug: 'accessoires', label: 'Accessoires', emoji: '👜', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 2, parentId: null },
  { slug: 'luxe', label: 'Luxe', emoji: '💎', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 3, parentId: null },
  { slug: 'maison', label: 'Maison', emoji: '🏠', backgroundImage: null, bgColor: null, bgOpacity: 0.5, order: 4, parentId: null },
]

/**
 * Returns ALL boutique categories (top-level + subcategories), ordered.
 * Auto-seeds the DB with defaults on first access.
 */
export async function getBoutiqueCategories() {
  let cats = await db.boutiqueCategory.findMany({
    orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
  })

  if (cats.length === 0) {
    try {
      await db.boutiqueCategory.createMany({
        data: DEFAULT_CATEGORIES.map(({ slug, label, emoji, backgroundImage, bgColor, bgOpacity, order, parentId }) => ({
          slug, label, emoji, backgroundImage, bgColor, bgOpacity, order, parentId,
        })),
      })
      cats = await db.boutiqueCategory.findMany({
        orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
      })
    } catch (e) {
      console.error('[getBoutiqueCategories] failed to seed defaults:', e)
      return DEFAULT_CATEGORIES
    }
  }

  return cats
}

/**
 * Returns only top-level categories (parentId is null), ordered.
 */
export async function getBoutiqueTopCategories() {
  const cats = await getBoutiqueCategories()
  return cats.filter(c => !c.parentId)
}

/**
 * Returns subcategories for a given parent slug, ordered.
 */
export async function getBoutiqueSubcategories(parentSlug: string) {
  const cats = await getBoutiqueCategories()
  return cats.filter(c => c.parentId === parentSlug)
}

/**
 * Returns a label map { slug → label } for all categories.
 * Useful for display in tables, order items, etc.
 */
export async function getBoutiqueCategoryLabelMap(): Promise<Record<string, string>> {
  const cats = await getBoutiqueCategories()
  const map: Record<string, string> = {}
  for (const c of cats) {
    map[c.slug] = c.label
  }
  return map
}
