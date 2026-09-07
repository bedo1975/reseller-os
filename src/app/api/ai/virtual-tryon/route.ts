import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/ai/virtual-tryon
 * Admin — performs a virtual try-on using either Replicate (IDM-VTON) or FASHN.ai.
 *
 * Body: {
 *   photoPath: "/uploads/sessions/xxx/yyy.webp",
 *   modelImage: "model_id" (ID of a VirtualTryOnModel in DB),
 *   category?: "upper_body" | "lower_body" | "dresses",
 *   garmentDes?: "description of the garment" (optional, improves quality)
 * }
 *
 * The provider is determined by AIConfig.vtonProvider ("replicate" | "fashn").
 *
 * Returns: { outputUrl: "https://..." } | { predictionId, provider, status }
 */

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { photoPath, modelImage, category, garmentDes } = body

    if (!photoPath) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }
    if (!modelImage) {
      return NextResponse.json({ error: 'Modèle requis' }, { status: 400 })
    }

    // Fetch the model from DB (admin can use any model, even inactive ones)
    const model = await db.virtualTryOnModel.findUnique({ where: { id: modelImage } })
    if (!model) {
      return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 })
    }

    // Get config
    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) {
      config = await db.aIConfig.create({ data: { userId: user.id, provider: 'zai' } })
    }

    const vtonProvider = config.vtonProvider || 'gemini'
    let apiKey: string | null = null
    if (vtonProvider === 'fashn') {
      apiKey = config.fashnApiKey
    } else if (vtonProvider === 'replicate') {
      apiKey = config.replicateApiKey
    } else if (vtonProvider === 'gemini') {
      apiKey = config.apiKey
    }

    if (!apiKey) {
      const providerName = vtonProvider === 'fashn' ? 'FASHN.ai' : vtonProvider === 'replicate' ? 'Replicate' : 'Google AI Studio (Gemini)'
      return NextResponse.json({
        error: `Clé API ${providerName} requise. Configurez-la dans Paramètres → IA → Essai virtuel.`
      }, { status: 400 })
    }

    // Construct the PUBLIC URL of the photo — Replicate downloads it itself.
    // Use the garment-image endpoint to convert WebP → JPEG on the fly (IDM-VTON can't handle WebP).
    const publicBaseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.get('host')}`
    const cleanPath = photoPath.startsWith('/') ? photoPath : '/' + photoPath
    const garmentUrl = `${publicBaseUrl}/api/ai/virtual-tryon/garment-image?path=${encodeURIComponent(cleanPath)}`
    console.log('[virtual-tryon] Garment URL:', garmentUrl, '| Model:', model.name)

    // The model image URL — if it's a local upload, prefix with the public base URL
    let modelImageUrl = model.imageUrl
    if (modelImageUrl.startsWith('/uploads/') || modelImageUrl.startsWith('/api/')) {
      modelImageUrl = `${publicBaseUrl}${modelImageUrl.startsWith('/api') ? '' : '/api'}${modelImageUrl}`
    }

    // Call the appropriate provider
    if (vtonProvider === 'fashn') {
      return await callFashn(apiKey, garmentUrl, modelImageUrl)
    } else if (vtonProvider === 'gemini') {
      return await callGemini(apiKey, garmentUrl, { url: modelImageUrl, label: model.name })
    } else {
      // Use the model's defaultPrompt if it exists, otherwise fall back to the user-provided garmentDes
      const finalGarmentDes = garmentDes || model.defaultPrompt || ''
      return await callReplicate(apiKey, garmentUrl, modelImageUrl, category || 'upper_body', finalGarmentDes)
    }
  } catch (error) {
    console.error('POST /api/ai/virtual-tryon error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Call Gemini (Nano Banana — gemini-2.5-flash-image)
 */
async function callGemini(apiKey: string, garmentUrl: string, modelConfig: { url: string; label: string }) {
  const genderHint = modelConfig.label.toLowerCase().includes('femme') ? 'a woman' : 'a man'
  const prompt = `Look at this clothing item. Generate a photorealistic image of ${genderHint} wearing this exact garment. The person should be standing, facing forward, in good lighting against a clean neutral background. The garment should fit naturally on the person. Keep the garment's color, pattern, and details exactly as shown in the original image.`

  // Download the garment image and send as base64 to Gemini
  const imgRes = await fetch(garmentUrl)
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imgBuffer.toString('base64') } },
        ],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let errMsg = ''
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson?.error?.message || errJson?.error || ''
    } catch {
      errMsg = errText.slice(0, 300)
    }
    console.error('[virtual-tryon] Gemini API error:', res.status, errMsg)
    if (res.status === 401 || res.status === 403) return NextResponse.json({ error: 'Clé API Google AI Studio invalide.' }, { status: 401 })
    if (res.status === 429) return NextResponse.json({ error: 'Quota Gemini dépassé. Attendez quelques minutes.' }, { status: 429 })
    return NextResponse.json({ error: `Erreur Gemini: ${errMsg}` }, { status: 500 })
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  if (!parts) {
    return NextResponse.json({ error: 'Gemini n\'a pas retourné d\'image. Essayez une autre photo.' }, { status: 500 })
  }

  const imagePart = parts.find((p: any) => p.inline_data || p.inlineData)
  if (!imagePart) {
    const textPart = parts.find((p: any) => p.text)
    const textMsg = textPart?.text || 'Aucune image générée'
    return NextResponse.json({ error: `Gemini: ${textMsg.slice(0, 200)}` }, { status: 500 })
  }

  const inlineData = imagePart.inline_data || imagePart.inlineData
  const base64Image = inlineData.data
  const mimeType = inlineData.mime_type || inlineData.mimeType || 'image/png'
  const outputDataUri = `data:${mimeType};base64,${base64Image}`

  return NextResponse.json({ outputUrl: outputDataUri })
}

/**
 * Call Replicate IDM-VTON
 */
async function callReplicate(apiKey: string, garmentImage: string, modelImage: string, category: string, garmentDes: string) {
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // NOTE: on NE met PAS 'Prefer: wait' car ça fait attendre 30-60s la réponse
      // de Replicate, ce qui dépasse le timeout de Next.js (~15s) → erreur 500.
      // À la place, on retourne immédiatement le predictionId et le frontend poll.
    },
    body: JSON.stringify({
      version: 'cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4',
      input: {
        garm_img: garmentImage,
        human_img: modelImage,
        category: category || 'upper_body',
        crop: false,
        // garment_des is REQUIRED by the model — without it, the model crashes with
        // "can only concatenate str (not NoneType) to str"
        garment_des: garmentDes || 'a clothing item',
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
    console.error('[virtual-tryon] Replicate API error:', createRes.status, errMsg)
    if (createRes.status === 401) return NextResponse.json({ error: 'Clé API Replicate invalide.' }, { status: 401 })
    if (createRes.status === 402) return NextResponse.json({ error: 'Crédits Replicate insuffisants.' }, { status: 402 })
    return NextResponse.json({ error: `Erreur Replicate: ${errMsg}` }, { status: 500 })
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
}

/**
 * Call FASHN.ai
 */
async function callFashn(apiKey: string, garmentImage: string, modelImage: string) {
  const createRes = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_image: modelImage,
      garment_image: garmentImage,
    }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text()
    let errMsg = ''
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson?.error || errJson?.message || errJson?.detail || ''
    } catch {
      errMsg = errText.slice(0, 300)
    }
    console.error('[virtual-tryon] FASHN API error:', createRes.status, errMsg)
    if (createRes.status === 401) return NextResponse.json({ error: 'Clé API FASHN invalide.' }, { status: 401 })
    if (createRes.status === 402 || createRes.status === 429) return NextResponse.json({ error: 'Crédits FASHN insuffisants. 10 crédits gratuits à l\'inscription.' }, { status: 402 })
    return NextResponse.json({ error: `Erreur FASHN: ${errMsg}` }, { status: 500 })
  }

  const prediction = await createRes.json()

  if (prediction.status === 'completed' && prediction.output) {
    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
    return NextResponse.json({ outputUrl })
  }

  if (prediction.status === 'failed') {
    return NextResponse.json({ error: 'La transformation a échoué.' }, { status: 500 })
  }

  return NextResponse.json({
    predictionId: prediction.id,
    provider: 'fashn',
    status: prediction.status,
    message: 'Transformation en cours...',
  })
}

/**
 * GET /api/ai/virtual-tryon?id=xxx
 * Polls the status of a virtual try-on prediction.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const predictionId = searchParams.get('id')
    const provider = searchParams.get('provider') || 'replicate'

    if (!predictionId) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) return NextResponse.json({ error: 'Config introuvable' }, { status: 404 })

    const apiKey = provider === 'fashn' ? config.fashnApiKey : config.replicateApiKey
    if (!apiKey) return NextResponse.json({ error: 'Clé API requise' }, { status: 400 })

    if (provider === 'fashn') {
      const res = await fetch(`https://api.fashn.ai/v1/status/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (!res.ok) return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })

      const prediction = await res.json()
      if (prediction.status === 'completed' && prediction.output) {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        return NextResponse.json({ status: 'succeeded', outputUrl })
      }
      if (prediction.status === 'failed') {
        return NextResponse.json({ status: 'failed', error: 'La transformation a échoué' }, { status: 500 })
      }
      return NextResponse.json({ status: prediction.status })
    } else {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (!res.ok) return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })

      const prediction = await res.json()
      if (prediction.status === 'succeeded' && prediction.output) {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        return NextResponse.json({ status: 'succeeded', outputUrl })
      }
      if (prediction.status === 'failed') {
        console.error('[virtual-tryon] GET: Replicate prediction FAILED:', JSON.stringify(prediction).slice(0, 1000))
        return NextResponse.json({ status: 'failed', error: prediction.error || 'La transformation a échoué' }, { status: 500 })
      }
      return NextResponse.json({ status: prediction.status })
    }
  } catch (error) {
    console.error('GET /api/ai/virtual-tryon error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
