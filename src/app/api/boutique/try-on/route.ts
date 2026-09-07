import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/try-on
 * Public — launches a virtual try-on for a boutique client.
 *
 * The client's uploaded photo becomes the "human_img" (the person wearing the garment).
 * The product photo (identified by SKU) becomes the "garm_img" (the garment).
 *
 * Body: {
 *   clientPhotoPath: "/uploads/tryon-temp/xxx.jpg",  // client's photo (uploaded via /upload)
 *   sku: "ART-001",                                  // product SKU from the catalog
 *   category?: "upper_body" | "lower_body" | "dresses",
 * }
 *
 * Returns: { predictionId, provider, status } | { outputUrl } | { error }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientPhotoPath, sku, category, prompt } = body

    if (!clientPhotoPath) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }
    if (!sku) {
      return NextResponse.json({ error: 'SKU produit requis' }, { status: 400 })
    }

    // Fetch the product from DB — must be published and visible on the boutique
    const product = await db.stockItem.findFirst({
      where: {
        sku,
        status: 'PUBLIE',
        stockType: 'boutique',
        suggestedPrice: { gt: 0 },
      },
      select: { id: true, sku: true, photos: true, title: true, brand: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // Parse the product photos to get the main one
    let photos: string[] = []
    try { photos = JSON.parse(product.photos) } catch {}
    if (photos.length === 0) {
      return NextResponse.json({ error: 'Ce produit n\'a pas de photo' }, { status: 404 })
    }
    const garmentPhoto = photos[0]  // main photo

    // Get the admin's AIConfig (first user with a Replicate API key)
    const config = await db.aIConfig.findFirst({
      where: { replicateApiKey: { not: null } },
      orderBy: { createdAt: 'asc' },
    })
    if (!config || !config.replicateApiKey) {
      return NextResponse.json({
        error: 'Le service d\'essai virtuel n\'est pas configuré. Veuillez réessayer plus tard.'
      }, { status: 503 })
    }

    const apiKey = config.replicateApiKey

    // Construct the PUBLIC URLs — Replicate downloads them itself.
    const publicBaseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.get('host')}`

    // Garment (product) URL — use the garment-image endpoint to convert WebP → JPEG
    const garmentUrl = `${publicBaseUrl}/api/ai/virtual-tryon/garment-image?path=${encodeURIComponent(garmentPhoto)}`
    // Client photo URL (already JPG — converted during upload)
    const humanUrl = `${publicBaseUrl}/api${clientPhotoPath.startsWith('/') ? clientPhotoPath : '/' + clientPhotoPath}`

    console.log('[boutique-try-on] Starting prediction for SKU', sku, {
      garmentUrl,
      humanUrl,
      category: category || 'upper_body',
    })

    // Call Replicate IDM-VTON (no Prefer: wait — we return immediately and poll)
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4',
        input: {
          garm_img: garmentUrl,
          human_img: humanUrl,
          category: category || 'upper_body',
          crop: false,
          // Use the user-provided prompt if set, otherwise the model's defaultPrompt, otherwise a generic description
          garment_des: prompt || model.defaultPrompt || `${product.brand} ${product.title || ''}`.trim() || 'a clothing item',
        },
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
      if (createRes.status === 401) {
        return NextResponse.json({ error: 'Configuration du service invalide.' }, { status: 503 })
      }
      if (createRes.status === 402) {
        return NextResponse.json({ error: 'Service temporairement indisponible (crédits épuisés).' }, { status: 503 })
      }
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
