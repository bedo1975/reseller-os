import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireClient } from '@/lib/boutique-client-auth'
import { getVtonCategory, isTryOnEnabled } from '@/lib/vton-category-mapper'

/**
 * POST /api/boutique/try-on
 * Lance l'essai virtuel en prenant en compte la détection auto OU le choix du client.
 */
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

    if (!clientPhotoPath) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }
    if (!sku) {
      return NextResponse.json({ error: 'SKU produit requis' }, { status: 400 })
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

    // 3. Vérification de compatibilité de l'article (exclure chaussures, accessoires...)
    if (!isTryOnEnabled(product.category, product.subcategory)) {
      return NextResponse.json({
        error: 'Cet article n\'est pas compatible avec l\'essai virtuel (accessoire, chaussure ou objet de maison).'
      }, { status: 400 })
    }

    // 4. Détermination intelligente de la catégorie
    const detectedCategory = getVtonCategory(product.category, product.subcategory)
    
    // Dictionnaire pour convertir le choix texte du client en paramètre d'IA
    const clientChoiceMap: Record<string, 'upper_body' | 'lower_body' | 'dresses'> = {
      'haut': 'upper_body',
      'sweatshirt': 'upper_body',
      'sweat': 'upper_body',
      't-shirt': 'upper_body',
      'chemise': 'upper_body',
      'veste': 'upper_body',
      
      'bas': 'lower_body',
      'jean': 'lower_body',
      'pantalon': 'lower_body',
      'short': 'lower_body',
      'jupe': 'lower_body',
      
      'robe': 'dresses',
      'combinaison': 'dresses',
      'dress': 'dresses'
    }

    // On applique le choix du client en priorité, sinon la détection automatique
    let finalCategory: 'upper_body' | 'lower_body' | 'dresses' | null = null

    if (category) {
      const cleanCategory = category.toLowerCase().trim()
      finalCategory = clientChoiceMap[cleanCategory] || (cleanCategory as any) 
    }

    if (!finalCategory) {
      finalCategory = detectedCategory
    }

    // SÉCURITÉ : Si on ne sait toujours pas, on arrête les frais au lieu de forcer un haut par défaut
    if (!finalCategory) {
      return NextResponse.json({ 
        error: 'Impossible de déterminer automatiquement le type de vêtement. Veuillez préciser s\'il s\'agit d\'un Haut, d\'un Bas ou d\'une Robe.' 
      }, { status: 400 })
    }

    console.log('[boutique-try-on] Catégorie finale retenue :', finalCategory, '(Source client:', !!category, '/ Auto:', detectedCategory, ')')

    // 5. Gestion des photos du produit
    let photos: string[] = []
    try { photos = JSON.parse(product.photos) } catch {}
    if (photos.length === 0) {
      return NextResponse.json({ error: 'Ce produit n\'a pas de photo' }, { status: 404 })
    }
    const parsedIdx = typeof photoIndex === 'string' ? parseInt(photoIndex, 10) : photoIndex
    const idx = typeof parsedIdx === 'number' && !Number.isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < photos.length
      ? parsedIdx
      : 0
    const garmentPhoto = photos[idx]

    // 6. Configuration de Replicate
    const config = await db.aIConfig.findFirst({
      where: { replicateApiKey: { not: null } },
      orderBy: { createdAt: 'asc' },
    })
    if (!config || !config.replicateApiKey) {
      return NextResponse.json({
        error: 'Le service d\'essai virtuel n\'est pas configuré. Veuillez réessayer plus tard.'
      }, { status: 503 })
    }

    const model = await db.virtualTryOnModel.findFirst({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    if (!model) {
      return NextResponse.json({
        error: 'Aucun modèle disponible pour l\'essai virtuel. Veuillez réessayer plus tard.'
      }, { status: 503 })
    }

    const apiKey = config.replicateApiKey
    const publicBaseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.get('host')}`
    const garmentUrl = `${publicBaseUrl}/api/ai/virtual-tryon/garment-image?path=${encodeURIComponent(garmentPhoto)}`
    const humanUrl = `${publicBaseUrl}/api${clientPhotoPath.startsWith('/') ? clientPhotoPath : '/' + clientPhotoPath}`

    const modelId = config.vtonModelId || 'cuuupid/idm-vton'
    const defaultVersions: Record<string, string> = {
      'cuuupid/idm-vton': '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
    }
    const version = config.vtonVersion || defaultVersions[modelId] || ''
    if (!version) {
      return NextResponse.json({ error: `Version manquante pour le modèle ${modelId}.` }, { status: 500 })
    }

    // 7. Construction des paramètres d'entrée pour l'IA
    let input: Record<string, unknown> = {}
    const garmentDes = prompt
      || (product as any).tryOnDescription
      || model.defaultPrompt
      || `${product.brand} ${product.title || ''}`.trim()
      || 'a clothing item'

    if (modelId === 'cuuupid/idm-vton') {
      input = {
        garm_img: garmentUrl,
        human_img: humanUrl,
        category: finalCategory,
        crop: false,
        garment_des: garmentDes,
      }
    } else if (modelId.includes('flux-virtual-try-on') || modelId.includes('kolors')) {
      const garmentType = finalCategory === 'lower_body' ? 'bottom' : finalCategory === 'dresses' ? 'dress' : 'top'
      input = {
        garment_image: garmentUrl,
        model_image: humanUrl,
        garment_type: garmentType,
      }
    } else {
      input = {
        garm_img: garmentUrl,
        human_img: humanUrl,
        garment_image: garmentUrl,
        model_image: humanUrl,
        category: finalCategory,
        garment_type: finalCategory === 'lower_body' ? 'bottom' : finalCategory === 'dresses' ? 'dress' : 'top',
        garment_des: garmentDes,
        crop: false,
      }
    }

    if (config.vtonCustomParams) {
      try {
        const customParams = JSON.parse(config.vtonCustomParams)
        input = { ...input, ...customParams }
      } catch (e) {
        console.error('[boutique-try-on] Invalid vtonCustomParams JSON:', e)
      }
    }

    console.log('[boutique-try-on] Starting prediction for SKU', sku, {
      model: modelId,
      version: version.slice(0, 20) + '...',
      inputKeys: Object.keys(input),
    })

    // 8. Envoi de la requête à l'API Replicate
    const createRes = await fetch('https://replicate.com', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: `${modelId}:${version}`,
        input,
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      let errMsg = ''
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson?.detail || errJson?.error || errJson?.message || ''
      } catch {
        errMsg = errText.slice(0, 300)
      }
      console.error('[boutique-try-on] Replicate API error:', createRes.status, errMsg)
      if (createRes.status === 401) return NextResponse.json({ error: 'Configuration du service invalide.' }, { status: 503 })
      if (createRes.status === 402) return NextResponse.json({ error: 'Service temporairement indisponible (crédits épuisés).' }, { status: 503 })
      return NextResponse.json({ error: `Erreur: ${errMsg}` }, { status: 500 })
    }

    const prediction = await createRes.json()

    if (prediction.status === 'succeeded' && prediction.output) {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      return NextResponse.json({ outputUrl })
    }

    if (prediction.status === 'failed') {
      return NextResponse.json({ error: 'La transformation a échoué.' }, { status: 500 })
    }

    return NextResponse.json({
      predictionId: prediction.id,
      provider: 'replicate',
      status: prediction.status,
      message: 'Transformation en cours...',
    })
  } catch (error) {
    console.error('POST /api/boutique/try-on error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
