/**
 * Maps a product's category + subcategory to the IDM-VTON "category" param.
 *
 * IDM-VTON accepts 3 values:
 *   - "upper_body"  → tops (t-shirts, shirts, jackets, sweaters, etc.)
 *   - "lower_body"  → bottoms (pants, jeans, shorts, skirts, etc.)
 *   - "dresses"     → dresses and full-body outfits
 *
 * For accessories (caps, bags, jewelry, etc.) or other categories that don't
 * fit the try-on model, we return null — the caller can decide to show an
 * error message or skip the try-on feature for these products.
 */

// Subcategory keywords → IDM-VTON category
// Keys are lowercase, matched against the product's subcategory (and category as fallback)
const SUBCATEGORY_MAP: Record<string, 'upper_body' | 'lower_body' | 'dresses'> = {
  // Upper body
  'tshirt': 'upper_body', 't-shirt': 'upper_body', 't shirt': 'upper_body',
  'tee': 'upper_body', 'tshirts': 'upper_body',
  'shirt': 'upper_body', 'shirts': 'upper_body',
  'chemise': 'upper_body', 'chemises': 'upper_body',
  'pull': 'upper_body', 'pulls': 'upper_body',
  'sweater': 'upper_body', 'sweaters': 'upper_body',
  'sweat': 'upper_body', 'sweats': 'upper_body',
  'hoodie': 'upper_body', 'hoodies': 'upper_body',
  'veste': 'upper_body', 'vestes': 'upper_body',
  'jacket': 'upper_body', 'jackets': 'upper_body',
  'blazer': 'upper_body', 'blazers': 'upper_body',
  'manteau': 'upper_body', 'manteaux': 'upper_body',
  'coat': 'upper_body', 'coats': 'upper_body',
  'cardigan': 'upper_body', 'cardigans': 'upper_body',
  'gilet': 'upper_body', 'gilets': 'upper_body',
  'polo': 'upper_body', 'polos': 'upper_body',
  'top': 'upper_body', 'tops': 'upper_body',
  'blouse': 'upper_body', 'blouses': 'upper_body',
  'tunic': 'upper_body', 'tunics': 'upper_body',
  'windbreaker': 'upper_body', 'windbreakers': 'upper_body',
  'bomber': 'upper_body', 'bombers': 'upper_body',
  'denim jacket': 'upper_body',
  'leather jacket': 'upper_body',

  // Lower body
  'pantalon': 'lower_body', 'pantalons': 'lower_body',
  'jean': 'lower_body', 'jeans': 'lower_body',
  'pant': 'lower_body', 'pants': 'lower_body',
  'trouser': 'lower_body', 'trousers': 'lower_body',
  'short': 'lower_body', 'shorts': 'lower_body',
  'jogging': 'lower_body', 'joggings': 'lower_body',
  'sweatpant': 'lower_body', 'sweatpants': 'lower_body',
  'legging': 'lower_body', 'leggings': 'lower_body',
  'jupe': 'lower_body', 'jupes': 'lower_body',
  'skirt': 'lower_body', 'skirts': 'lower_body',
  'cargo': 'lower_body', 'cargos': 'lower_body',

  // Dresses
  'robe': 'dresses', 'robes': 'dresses',
  'dress': 'dresses', 'dresses': 'dresses',
  'jumpsuit': 'dresses', 'jumpsuits': 'dresses',
  'combinaison': 'dresses', 'combinaisons': 'dresses',
  'overalls': 'dresses',
  'kaftan': 'dresses', 'kaftans': 'dresses',
}

// Top-level category fallback (when subcategory doesn't match)
const CATEGORY_FALLBACK: Record<string, 'upper_body' | 'lower_body' | 'dresses' | null> = {
  'vetements': 'upper_body',       // default to upper body for "Vêtements"
  'chaussures': null,               // shoes are not try-on-able
  'accessoires': null,              // accessories are not try-on-able
  'luxe': 'upper_body',            // default to upper body for "Luxe"
  'maison': null,                   // home items are not try-on-able
}

export type VtonCategory = 'upper_body' | 'lower_body' | 'dresses' | null

/**
 * Determines the IDM-VTON category for a product based on its category and subcategory.
 *
 * @param category    The product's top-level category (ex: "vetements", "accessoires")
 * @param subcategory The product's subcategory (ex: "tshirts", "jeans", "robes")
 * @returns           "upper_body" | "lower_body" | "dresses" | null (null = not try-on-able)
 */
export function getVtonCategory(category?: string | null, subcategory?: string | null): VtonCategory {
  // 1. Try to match the subcategory first (more specific)
  if (subcategory) {
    const sub = subcategory.toLowerCase().trim()
    // Direct match
    if (SUBCATEGORY_MAP[sub]) return SUBCATEGORY_MAP[sub]
    // Partial match (subcategory contains a keyword)
    for (const [key, value] of Object.entries(SUBCATEGORY_MAP)) {
      if (sub.includes(key)) return value
    }
  }

  // 2. Fall back to the top-level category
  if (category) {
    const cat = category.toLowerCase().trim()
    if (CATEGORY_FALLBACK[cat] !== undefined) return CATEGORY_FALLBACK[cat]
  }

  // 3. Default to upper_body if nothing matches
  // (most clothing items are upper body, and it's better than returning null)
  return 'upper_body'
}

/**
 * Returns true if the product can be tried on (based on its category).
 * Accessories, shoes, and home items are excluded.
 */
export function isTryOnEnabled(category?: string | null, subcategory?: string | null): boolean {
  if (!category) return true // default: enabled
  const cat = category.toLowerCase().trim()
  // Explicitly disabled categories
  if (cat === 'chaussures' || cat === 'accessoires' || cat === 'maison') {
    // But check if the subcategory is try-on-able (ex: a skirt under "accessoires")
    if (subcategory) {
      const sub = subcategory.toLowerCase().trim()
      for (const [key] of Object.entries(SUBCATEGORY_MAP)) {
        if (sub.includes(key)) return true
      }
    }
    return false
  }
  return true
}

/**
 * Returns a human-readable label for the IDM-VTON category.
 * Used in the UI to show the client what type of garment was detected.
 */
export function getVtonCategoryLabel(category: VtonCategory): string {
  switch (category) {
    case 'upper_body': return 'Haut (t-shirt, veste, pull…)'
    case 'lower_body': return 'Bas (pantalon, jupe…)'
    case 'dresses': return 'Robe / Tenue complète'
    default: return 'Type non reconnu'
  }
}
