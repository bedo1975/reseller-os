import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { AI_PROVIDERS } from '../config/route'
import fs from 'fs'
import path from 'path'

const ANALYZE_PROMPT = `Tu es un expert en revente de vêtements et accessoires de seconde main.

Analyse cette photo d'article et retourne UNIQUEMENT un JSON valide (sans markdown, sans \`\`\`) avec ces champs :
{
  "brand": "Marque détectée (ou null si non identifiable)",
  "category": "Type d'article parmi: vetements, chaussures, accessoires, luxe, maison",
  "size": "Taille si visible sur l'étiquette (ou null)",
  "color": "Couleur principale en français",
  "condition": "État estimé parmi: neuf, tres-bon, bon, correct",
  "description": "Description courte de 2-3 phrases pour une annonce de revente",
  "estimatedPrice": "Prix de revente conseillé en euros (nombre seul, ex: 29.99)"
}

Sois précis sur la marque. Si tu reconnais un modèle précis, mentionne-le dans la description.
Si tu n'es pas sûr de la marque, retourne null pour "brand".`

function parseJsonResponse(text: string) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  return JSON.parse(cleaned)
}

async function analyzeWithOpenAICompat(baseUrl: string, apiKey: string, model: string, base64Image: string, mimeType: string) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://reseller-os.local', 'X-Title': 'Reseller OS' } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: ANALYZE_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse cet article :' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 401) throw new Error('Clé API invalide.')
    if (res.status === 429) throw new Error('Quota dépassé.')
    if (res.status === 404) throw new Error(`Modèle "${model}" introuvable.`)
    throw new Error(`API error (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  return parseJsonResponse(text)
}

async function analyzeWithGemini(apiKey: string, model: string, base64Image: string, mimeType: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: ANALYZE_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 600, responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) throw new Error('Quota Gemini dépassé.')
    throw new Error(`Gemini error (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return parseJsonResponse(text)
}

async function analyzeWithZai(base64Image: string, mimeType: string) {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: ANALYZE_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyse cet article :' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })
  const text = completion.choices[0]?.message?.content || ''
  return parseJsonResponse(text)
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { photoUrl } = body

    if (!photoUrl) return NextResponse.json({ error: 'URL de photo requise' }, { status: 400 })

    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) {
      config = await db.aIConfig.create({ data: { userId: user.id, provider: 'zai', apiKey: null, model: null } })
    }

    const providerConfig = AI_PROVIDERS[config.provider as keyof typeof AI_PROVIDERS]
    if (!providerConfig) throw new Error(`Fournisseur inconnu: ${config.provider}`)

    // Vérifie que le provider supporte la vision
    if (!providerConfig.vision) {
      throw new Error(`${providerConfig.label} ne supporte pas l'analyse d'images. Utilisez Groq, OpenRouter, NVIDIA, Gemini, Kimi ou OpenAI dans Paramètres → IA.`)
    }

    // Lit l'image
    let base64Image: string | null = null
    let mimeType = 'image/jpeg'

    if (photoUrl.startsWith('/uploads/')) {
      const filePath = path.resolve(process.cwd(), 'public', photoUrl.replace(/^\//, ''))
      if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Image introuvable' }, { status: 404 })
      const buffer = fs.readFileSync(filePath)
      base64Image = buffer.toString('base64')
      const ext = path.extname(filePath).toLowerCase()
      if (ext === '.png') mimeType = 'image/png'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (ext === '.gif') mimeType = 'image/gif'
    } else if (photoUrl.startsWith('http')) {
      const res = await fetch(photoUrl)
      if (!res.ok) return NextResponse.json({ error: 'Image inaccessible' }, { status: 400 })
      const buffer = Buffer.from(await res.arrayBuffer())
      base64Image = buffer.toString('base64')
      mimeType = res.headers.get('content-type') || 'image/jpeg'
    } else {
      return NextResponse.json({ error: 'URL non supportée' }, { status: 400 })
    }

    if (!base64Image) throw new Error('Impossible de lire l\'image')

    // Handle deprecated models (same mapping as /api/ai/description)
    let model = config.model || providerConfig.defaultModel
    const DEPRECATED: Record<string, string> = {
      'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
      'llama-3.1-70b-versatile': 'openai/gpt-oss-120b',
      'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
      'gemini-1.5-flash': 'gemini-2.5-flash',
      'gemini-2.0-flash': 'gemini-2.5-flash',
      'gemini-2.0-flash-exp': 'gemini-2.5-flash',
      'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-2.5-pro': 'gemini-2.5-flash',
    }
    if (DEPRECATED[model]) model = DEPRECATED[model]

    let result
    if (providerConfig.type === 'zai') {
      result = await analyzeWithZai(base64Image, mimeType)
    } else if (providerConfig.type === 'gemini') {
      if (!config.apiKey) throw new Error('Clé API Gemini requise.')
      result = await analyzeWithGemini(config.apiKey, model, base64Image, mimeType)
    } else {
      // openai_compat
      if (!config.apiKey) throw new Error(`Clé API ${providerConfig.label} requise.`)
      result = await analyzeWithOpenAICompat(providerConfig.baseUrl, config.apiKey, model, base64Image, mimeType)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/ai/analyze-photo error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur' }, { status: 500 })
  }
}
