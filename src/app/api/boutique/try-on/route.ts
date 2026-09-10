import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireClient } from '@/lib/boutique-client-auth'
import { getVtonCategory, isTryOnEnabled } from '@/lib/vton-category-mapper'
import Replicate from 'replicate'

export async function POST(req: NextRequest) {
  try {
    // 1. Vérification de la session client
    try {
      await requireClient()
    } catch {
      return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })
    }

    const body = await req.json()
    const { clientPhotoPath, sku, category, prompt, photoIndex } = body

    if (!clientPhotoPath || !sku) {
      return NextResponse.json({ error: 'Données requises manquantes' }, { status: 400 })
    }

    // 2. Récupération du produit en Base de Données
    const product = await db.stockItem.findFirst({
      where: {
        sku,
        status: 'PUBLIE',
        stockType: 'boutique',
        suggestedPrice: { gt: 0 },
      },
      select: { id: true, sku: true, photos: true, title: true, brand: true, category: true, subcategory: true, tryOnDescription: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // 3. Vérification de compatibilité de l'article
    if (!isTryOnEnabled(product.category, product.subcategory)) {
      return NextResponse.json({
        error: 'Cet article n\'est pas compatible avec l\'essai virtuel.'
      }, { status: 400 })
    }

    // 4. Détermination intelligente de la catégorie
   // 4. Détermination intelligente de la catégorie (Catalogue + Titre + Choix client)
const detectedCategory = getVtonCategory(product.category, product.subcategory)

// Dictionnaire pour convertir le choix texte du client ou les mots du titre
const clientChoiceMap: Record<string, 'upper_body' | 'lower_body' | 'dresses'> = {
  'haut': 'upper_body', 'sweatshirt': 'upper_body', 'sweat': 'upper_body', 't-shirt': 'upper_body', 'chemise': 'upper_body', 'veste': 'upper_body',
  'bas': 'lower_body', 'jean': 'lower_body', 'pantalon': 'lower_body', 'short': 'lower_body', 'jupe': 'lower_body', 'denim': 'lower_body',
  'robe': 'dresses', 'combinaison': 'dresses', 'dress': 'dresses'
}

let finalCategory: 'upper_body' | 'lower_body' | 'dresses' | null = null

// Priorité 1 : Le choix manuel du client s'il a cliqué sur l'interface
if (category) {
  const cleanCategory = category.toLowerCase().trim()
  finalCategory = clientChoiceMap[cleanCategory] || (cleanCategory as any)
}

// Priorité 2 : Si pas de choix client, on fouille le TITRE du produit à la recherche de mots-clés
if (!finalCategory && product.title) {
  const cleanTitle = product.title.toLowerCase()
  // Si le titre contient "jean", "pantalon", "short", etc.
  if (cleanTitle.includes('jean') || cleanTitle.includes('pantalon') || cleanTitle.includes('denim') || cleanTitle.includes('bas')) {
    finalCategory = 'lower_body'
  } else if (cleanTitle.includes('robe') || cleanTitle.includes('combinaison')) {
    finalCategory = 'dresses'
  } else if (cleanTitle.includes('t-shirt') || cleanTitle.includes('chemise') || cleanTitle.includes('pull') || cleanTitle.includes('veste') || cleanTitle.includes('haut')) {
    finalCategory = 'upper_body'
  }
}

// Priorité 3 : Si le titre ne donne rien, on utilise la détection automatique des dossiers du catalogue
if (!finalCategory) {
  finalCategory = detectedCategory
}

// Sécurité finale : Si vraiment on ne sait pas, on s'arrête au lieu de générer une robe
if (!finalCategory) {
  return NextResponse.json({ 
    error: 'Impossible de déterminer automatiquement le type de vêtement (Haut, Bas, Robe). Veuillez vérifier sa catégorie dans le catalogue.' 
  }, { status: 400 })
}

console.log('[boutique-try-on] Catégorie finale retenue :', finalCategory, '(Source : Titre ou catalogue)')


    // 5. Gestion des photos du produit
    let photos: string[] = []
    try { photos = JSON.parse(product.photos) } catch {}
    if (photos.length === 0) {
      return NextResponse.json({ error: 'Ce produit n\'a pas de photo' }, { status: 404 })
    }
    const idx = typeof photoIndex === 'number' && photoIndex >= 0 && photoIndex < photos.length ? photoIndex : 0
    const garmentPhoto = photos[idx]

    // 6. Configuration de Replicate
    const config = await db.aIConfig.findFirst({
      where: { replicateApiKey: { not: null } },
      orderBy: { createdAt: 'asc' },
    })
    if (!config || !config.replicateApiKey) {
      return NextResponse.json({ error: 'Le service n\'est pas configuré.' }, { status: 503 })
    }

    // Initialisation du client Replicate
    const replicate = new Replicate({ auth: config.replicateApiKey })

    const modelId = config.vtonModelId || 'cuuupid/idm-vton'
    const defaultVersions: Record<string, string> = {
      'cuuupid/idm-vton': '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
    }
    const version = config.vtonVersion || defaultVersions[modelId] || ''
    if (!version) {
      return NextResponse.json({ error: `Version manquante pour le modèle ${modelId}.` }, { status: 500 })
    }

    const publicBaseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.get('host')}`
    const garmentUrl = `${publicBaseUrl}/api/ai/virtual-tryon/garment-image?path=${encodeURIComponent(garmentPhoto)}`
    const humanUrl = `${publicBaseUrl}/api${clientPhotoPath.startsWith('/') ? clientPhotoPath : '/' + clientPhotoPath}`

    const garmentDes = prompt || (product as any).tryOnDescription || `${product.brand} ${product.title || ''}`.trim() || 'clothing'

    // 7. Alignement STRICT des entrées de l'IA (Correction de l'inversion)
    let input: Record<string, unknown> = {}
    
    if (modelId === 'cuuupid/idm-vton') {
      input = { 
        garm_img: garmentUrl,       // Le produit (vêtement seul)
        human_img: humanUrl,       // L'humain (la photo du client)
        category: finalCategory,   // 'upper_body', 'lower_body' ou 'dresses'
        crop: true,                // Force l'adaptation automatique au format 3:4 requis
        garment_des: garmentDes 
      }
    } else {
      const garmentType = finalCategory === 'lower_body' ? 'bottom' : finalCategory === 'dresses' ? 'dress' : 'top'
      input = { 
        garment_image: garmentUrl, // Le produit
        model_image: humanUrl,     // L'humain
        garment_type: garmentType 
      }
    }

    console.log('[boutique-try-on] Lancement de la prédiction avec les bons rôles d\'images.')

    const prediction = await replicate.predictions.create({
      version: version,
      input: input,
    })

    if (prediction.status === 'failed') {
      return NextResponse.json({ error: 'La transformation a échoué.' }, { status: 500 })
    }

    return NextResponse.json({
      predictionId: prediction.id,
      provider: 'replicate',
      status: prediction.status,
      message: 'Transformation en cours...',
    })

  } catch (error: any) {
    console.error('POST /api/boutique/try-on error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
