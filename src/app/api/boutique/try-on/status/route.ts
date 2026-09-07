import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/try-on/status?id=xxx
 * Public — polls the status of a virtual try-on prediction.
 *
 * Returns: { status: "succeeded", outputUrl } | { status: "processing" } | { status: "failed", error }
 *
 * The Replicate API key is fetched from the first admin user (same as POST /api/boutique/try-on).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const predictionId = searchParams.get('id')

    if (!predictionId) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Get the admin's AIConfig (first user with a Replicate API key)
    const config = await db.aIConfig.findFirst({
      where: { replicateApiKey: { not: null } },
      orderBy: { createdAt: 'asc' },
    })
    if (!config || !config.replicateApiKey) {
      return NextResponse.json({ error: 'Service non configuré' }, { status: 503 })
    }

    const apiKey = config.replicateApiKey

    // Poll Replicate status
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })
    }

    const prediction = await res.json()

    if (prediction.status === 'succeeded' && prediction.output) {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      return NextResponse.json({ status: 'succeeded', outputUrl })
    }

    if (prediction.status === 'failed') {
      console.error('[boutique-try-on] Replicate prediction FAILED:', JSON.stringify(prediction).slice(0, 1000))
      return NextResponse.json({
        status: 'failed',
        error: prediction.error || 'La transformation a échoué'
      }, { status: 500 })
    }

    return NextResponse.json({ status: prediction.status })
  } catch (error) {
    console.error('GET /api/boutique/try-on/status error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
