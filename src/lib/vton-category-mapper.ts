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
 */
export function getVtonCategory(category?: string | null, subcategory?: string | null): VtonCategory {
  // 1. Essayer de faire correspondre la sous-catégorie d'abord (plus spécifique)
  if (subcategory) {
    const sub = subcategory.toLowerCase().trim()
    
    // Correspondance exacte directe
    if (SUBCATEGORY_MAP[sub]) return SUBCATEGORY_MAP[sub]
    
    // Correspondance intelligente par mot entier (évite les faux positifs)
    const sortedKeys = Object.keys(SUBCATEGORY_MAP).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
      const regex = new RegExp(`\\b${key}\\b`, 'i')
      if (regex.test(sub)) return SUBCATEGORY_MAP[key]
    }
  }

  // 2. Repli sur la catégorie principale
  if (category) {
    const cat = category.toLowerCase().trim()
    if (CATEGORY_FALLBACK[cat] !== undefined) return CATEGORY_FALLBACK[cat]
  }

  // 3. Si rien ne correspond, on renvoie null au lieu de forcer 'upper_body'
  return null
}

/**
 * Returns true if the product can be tried on (based on its category).
 */
export function isTryOnEnabled(category?: string | null, subcategory?: string | null): boolean {
  if (!category) return true // default: enabled
  const cat = category.toLowerCase().trim()
  
  if (cat === 'chaussures' || cat === 'accessoires' || cat === 'maison') {
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
 */
export function getVtonCategoryLabel(category: VtonCategory): string {
  switch (category) {
    case 'upper_body': return 'Haut (t-shirt, veste, pull…)'
    case 'lower_body': return 'Bas (pantalon, jupe…)'
    case 'dresses': return 'Robe / Tenue complète'
    default: return 'Type non reconnu'
  }
}
