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
    const detectedCategory = getVtonCategory(product.category, product.subcategory)
    const finalCategory = category || detectedCategory

    if (!finalCategory) {
      return NextResponse.json({ 
        error: 'Impossible de déterminer automatiquement le type de vêtement.' 
      }, { status: 400 })
    }

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
