import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'

/**
 * POST /api/ai/virtual-tryon
 * Admin — performs a virtual try-on using Replicate's IDM-VTON model.
 *
 * Body: { photoPath: "/uploads/sessions/xxx/yyy.webp", modelImage: "man_1" | "woman_1" | ... }
 *
 * The photoPath is the product photo (e.g. t-shirt on hanger).
 * The modelImage is a predefined mannequin/person reference image.
 *
 * Returns: { outputUrl: "https://replicate.delivery/..." } — the URL of the generated image.
 * The caller can then download this image and replace the original photo.
 */

// Predefined model/person images hosted on a public URL.
// These are simple, neutral background photos of people wearing plain clothes.
// The IDM-VTON model will replace the person's clothing with the product garment.
const MODEL_IMAGES: Record<string, { url: string; label: string }> = {
  'man_1': {
    label: 'Homme — debout, face',
    url: 'https://replicate.delivery/mgxt/IDM-VTON/assets/models/man_1.jpg',
  },
  'woman_1': {
    label: 'Femme — debout, face',
    url: 'https://replicate.delivery/mgxt/IDM-VTON/assets/models/woman_1.jpg',
  },
  'man_2': {
    label: 'Homme — décontracté',
    url: 'https://replicate.delivery/mgxt/IDM-VTON/assets/models/man_2.jpg',
  },
  'woman_2': {
    label: 'Femme — décontracté',
    url: 'https://replicate.delivery/mgxt/IDM-VTON/assets/models/woman_2.jpg',
  },
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { photoPath, modelImage } = body

    if (!photoPath) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }
    if (!modelImage || !MODEL_IMAGES[modelImage]) {
      return NextResponse.json({ error: 'Modèle invalide' }, { status: 400 })
    }

    // Get Replicate API key from AIConfig
    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) {
      config = await db.aIConfig.create({ data: { userId: user.id, provider: 'zai' } })
    }
    if (!config.replicateApiKey) {
      return NextResponse.json({
        error: 'Clé API Replicate requise. Configurez-la dans Paramètres → IA → Essai virtuel.'
      }, { status: 400 })
    }

    // Read the product photo from disk and convert to base64 data URI
    // (Replicate accepts data URIs for inputs)
    const fullPath = path.join(process.cwd(), 'public', photoPath.replace(/^\//, ''))
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Photo introuvable sur le disque' }, { status: 404 })
    }

    const photoBuffer = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/webp'
    const dataUri = `data:${mimeType};base64,${photoBuffer.toString('base64')}`

    const modelConfig = MODEL_IMAGES[modelImage]

    // Call Replicate API to create a prediction
    // Step 1: Create the prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.replicateApiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',  // Wait for the prediction to complete (up to 60s)
      },
      body: JSON.stringify({
        version: 'cuuupid/idm-vton@c11d5877d8a6d257e87ad7f57d2b1d3b1e1f3e0e',
        input: {
          model_image: modelConfig.url,
          garment_image: dataUri,
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
      if (createRes.status === 401) {
        return NextResponse.json({ error: 'Clé API Replicate invalide.' }, { status: 401 })
      }
      if (createRes.status === 402) {
        return NextResponse.json({ error: 'Crédits Replicate insuffisants. Ajoutez des crédits sur replicate.com.' }, { status: 402 })
      }
      return NextResponse.json({ error: `Erreur Replicate: ${errMsg}` }, { status: 500 })
    }

    const prediction = await createRes.json()

    // Check if prediction completed (with Prefer: wait, it should be done or have a status)
    if (prediction.status === 'succeeded' && prediction.output) {
      // output can be a string (URL) or array of strings
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      return NextResponse.json({
        outputUrl,
        modelLabel: modelConfig.label,
      })
    }

    if (prediction.status === 'failed') {
      return NextResponse.json({ error: 'La transformation a échoué. Essayez une autre photo ou un autre modèle.' }, { status: 500 })
    }

    // If not immediately done (timeout after 60s with Prefer: wait), return the prediction ID
    // so the client can poll for the result
    return NextResponse.json({
      predictionId: prediction.id,
      status: prediction.status,
      message: 'Transformation en cours. La photo sera prête dans quelques secondes.',
    })

  } catch (error) {
    console.error('POST /api/ai/virtual-tryon error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET /api/ai/virtual-tryon?id=xxx
 * Polls the status of a virtual try-on prediction (if it wasn't immediately done).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const predictionId = searchParams.get('id')

    if (!predictionId) {
      // Return list of available models
      return NextResponse.json({
        models: Object.entries(MODEL_IMAGES).map(([key, val]) => ({
          key,
          label: val.label,
        }))
      })
    }

    // Poll Replicate for the prediction status
    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config?.replicateApiKey) {
      return NextResponse.json({ error: 'Clé API Replicate requise' }, { status: 400 })
    }

    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${config.replicateApiKey}` },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Erreur lors de la vérification du statut' }, { status: 500 })
    }

    const prediction = await res.json()

    if (prediction.status === 'succeeded' && prediction.output) {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      return NextResponse.json({ status: 'succeeded', outputUrl })
    }

    if (prediction.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: 'La transformation a échoué' }, { status: 500 })
    }

    return NextResponse.json({ status: prediction.status })
  } catch (error) {
    console.error('GET /api/ai/virtual-tryon error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
