import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'


/**
 * POST /api/ai/virtual-tryon Test bug fix 
 * Admin — performs a virtual try-on using either Replicate (IDM-VTON) or FASHN.ai.
 *
 * Body: { photoPath: "/uploads/sessions/xxx/yyy.webp", modelImage: "man_1" | "woman_1" | ... }
 *
 * The provider is determined by AIConfig.vtonProvider ("replicate" | "fashn").
 *
 * Returns: { outputUrl: "https://..." } — the URL of the generated image.
 */

// Predefined model/person images hosted on Replicate's CDN (works for both providers
// since they both accept URL inputs).
// IMPORTANT: Replicate a supprimé les URLs https://replicate.delivery/mgxt/IDM-VTON/...
// (elles retournent 404). On utilise maintenant des images hébergées sur junashop.fr/models/.
// Pour ajouter de nouveaux mannequins : upload une photo dans public/models/ et ajoute l'URL ici.
const MODEL_IMAGES: Record<string, { url: string; label: string }> = {
  'man_1': {
    label: 'Homme — face',
    url: 'https://junashop.fr/api/models/man_face.jpg',
  },
  'woman_1': {
    label: 'Femme — face',
    url: 'https://junashop.fr/api/models/woman_face.jpg',
  },
}


export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { photoPath, modelImage, category } = body

    if (!photoPath) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }
    if (!modelImage || !MODEL_IMAGES[modelImage]) {
      return NextResponse.json({ error: 'Modèle invalide' }, { status: 400 })
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
    // The /api/uploads/ route is public (no auth) and serves the photo.
    // IMPORTANT: the IDM-VTON model can't handle data: URIs (base64) — it returns
    // "can only concatenate str (not NoneType) to str" when given a data URI.
      const publicBaseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.get('host')}`
    const cleanPath = photoPath.startsWith('/') ? photoPath : '/' + photoPath
    // Use the garment-image endpoint to convert WebP → JPEG on the fly
    // (IDM-VTON can't handle WebP)
    const garmentUrl = `${publicBaseUrl}/api/ai/virtual-tryon/garment-image?path=${encodeURIComponent(cleanPath)}`
    console.log('[virtual-tryon] Garment URL:', garmentUrl)

    const modelConfig = MODEL_IMAGES[modelImage]

    // Call the appropriate provider
    if (vtonProvider === 'fashn') {
      return await callFashn(apiKey, garmentUrl, modelConfig.url)
    } else if (vtonProvider === 'gemini') {
      return await callGemini(apiKey, garmentUrl, modelConfig)
    } else {
      return await callReplicate(apiKey, garmentUrl, modelConfig.url, category || 'upper_body')
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
 * Uses the Google AI Studio API. Accepts an image + text prompt.
 * The prompt asks Gemini to put the garment on a real person.
 * Returns the generated image as base64.
 *
 * Free with Google AI Studio API key (same key as the main AI config).
 */
async function callGemini(apiKey: string, garmentDataUri: string, modelConfig: { url: string; label: string }) {
  // Build the prompt for Gemini. We send the garment photo and ask it to
  // create an image of a real person wearing this garment.
  const genderHint = modelConfig.label.toLowerCase().includes('femme') ? 'a woman' : 'a man'
  const prompt = `Look at this clothing item. Generate a photorealistic image of ${genderHint} wearing this exact garment. The person should be standing, facing forward, in good lighting against a clean neutral background. The garment should fit naturally on the person. Keep the garment's color, pattern, and details exactly as shown in the original image.`

  // Call Gemini API — generateContent with inline_data (image) + text
  // Model: gemini-2.5-flash-image (Nano Banana) — supports image generation from image+text
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: garmentDataUri.split(';')[0].split(':')[1], data: garmentDataUri.split(',')[1] } },
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

  // Gemini returns parts with inline_data (base64 image) in the response
  const parts = data?.candidates?.[0]?.content?.parts
  if (!parts) {
    console.error('[virtual-tryon] Gemini no parts in response:', JSON.stringify(data).slice(0, 500))
    return NextResponse.json({ error: 'Gemini n\'a pas retourné d\'image. Essayez une autre photo.' }, { status: 500 })
  }

  // Find the image part
  const imagePart = parts.find((p: any) => p.inline_data || p.inlineData)
  if (!imagePart) {
    // Maybe Gemini returned only text (e.g. a refusal)
    const textPart = parts.find((p: any) => p.text)
    const textMsg = textPart?.text || 'Aucune image générée'
    return NextResponse.json({ error: `Gemini: ${textMsg.slice(0, 200)}` }, { status: 500 })
  }

  const inlineData = imagePart.inline_data || imagePart.inlineData
  const base64Image = inlineData.data
  const mimeType = inlineData.mime_type || inlineData.mimeType || 'image/png'

  // Return as a data URI that the frontend can display directly
  const outputDataUri = `data:${mimeType};base64,${base64Image}`

  return NextResponse.json({ outputUrl: outputDataUri })
}

/**
 * Call Replicate IDM-VTON
 */
async function callReplicate(apiKey: string, garmentImage: string, modelImage: string, category: string) {
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
 * FASHN uses a similar API: POST /v1/run, then poll /v1/status/{id}
 */
async function callFashn(apiKey: string, garmentImage: string, modelImage: string) {
  // Step 1: Create the prediction
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

  // FASHN returns { id: "xxx", status: "starting" | "processing" | "completed" | "failed" }
  if (prediction.status === 'completed' && prediction.output) {
    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
    return NextResponse.json({ outputUrl })
  }

  if (prediction.status === 'failed') {
    return NextResponse.json({ error: 'La transformation a échoué.' }, { status: 500 })
  }

  // Need to poll for the result
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
 * Also returns available models when called without id.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const predictionId = searchParams.get('id')
    const provider = searchParams.get('provider') || 'replicate'

    if (!predictionId) {
      return NextResponse.json({
        models: Object.entries(MODEL_IMAGES).map(([key, val]) => ({
          key, label: val.label,
        }))
      })
    }

    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) return NextResponse.json({ error: 'Config introuvable' }, { status: 404 })

       const apiKey = provider === 'fashn' ? config.fashnApiKey : config.replicateApiKey
    if (!apiKey) {
      console.error('[virtual-tryon] GET: No API key for provider:', provider)
      return NextResponse.json({ error: 'Clé API requise' }, { status: 400 })
    }
    console.log('[virtual-tryon] GET: polling prediction', predictionId, 'with provider', provider)

    if (provider === 'fashn') {
      // Poll FASHN status
      const res = await fetch(`https://api.fashn.ai/v1/status/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (!res.ok) return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })

      const prediction = await res.json()
      if (prediction.status === 'completed' && prediction.output) {
        console.log('[virtual-tryon] GET: Replicate prediction:', JSON.stringify({ status: prediction.status, hasOutput: !!prediction.output, error: prediction.error }))
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        return NextResponse.json({ status: 'succeeded', outputUrl })
      }
      if (prediction.status === 'failed') {
        return NextResponse.json({ status: 'failed', error: 'La transformation a échoué' }, { status: 500 })
      }
      return NextResponse.json({ status: prediction.status })
    } else {
      
      // Poll Replicate status
        const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      console.log('[virtual-tryon] GET: Replicate status response:', res.status)
      if (!res.ok) {
        const errText = await res.text()
        console.error('[virtual-tryon] GET: Replicate error response:', errText)
        return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })
      }

     const prediction = await res.json()
      console.log('[virtual-tryon] GET: Replicate prediction status:', prediction.status, '| error:', prediction.error, '| logs:', prediction.logs?.slice(-500))
      if (prediction.status === 'succeeded' && prediction.output) {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        return NextResponse.json({ status: 'succeeded', outputUrl })
      }
      if (prediction.status === 'failed') {
        console.error('[virtual-tryon] GET: Replicate prediction FAILED. Full prediction:', JSON.stringify(prediction).slice(0, 1000))
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
