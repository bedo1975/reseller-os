import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { AI_PROVIDERS } from '../config/route'

const SYSTEM_PROMPT = `Tu es un expert en rédaction d'annonces de revente pour des plateformes comme Vinted, Leboncoin, eBay et Vestiaire Collective.

Ta mission : rédiger une description d'annonce ATTRACTIVE, HONNÊTE et PROFESSIONNELLE qui maximise les chances de vente.

Règles de rédaction :
- 80 à 150 mots maximum (concis mais complet)
- Ton enthousiaste mais honnête
- Mentionne TOUJOURS l'état réel de l'article
- Inclus des mots-clés pertinents pour le référencement (marque, type, couleur, taille)
- Précise que c'est un article authentique si c'est une marque connue
- Mentionne que l'article a été nettoyé/vérifié si pertinent
- N'invente JAMAIS de caractéristiques non fournies
- Pas d'émojis
- Pas de hashtags
- Pas de mentions de prix dans la description (le prix est géré à part)
- Termine par une phrase d'appel à l'action douce (ex: "N'hésitez pas à me contacter pour toute question")

Réponds UNIQUEMENT avec la description, sans introduction ni commentaire.`

const DEPRECATED_MODELS: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-exp': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-2.5-pro': 'gemini-2.5-flash',
  // Llama 4 models were deprecated/renamed by Groq/NVIDIA/Cerebras
  'meta-llama/llama-4-scout-17b-16e-instruct': 'openai/gpt-oss-120b',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'openai/gpt-oss-120b',
  'llama-3.2-90b-vision-preview': 'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct:free': 'meta-llama/llama-3.3-70b-instruct:free',
  'meta/llama-4-scout-17b-16e-instruct': 'meta/llama-3.3-70b-instruct',
  'meta/llama-4-maverick-17b-128e-instruct': 'meta/llama-3.3-70b-instruct',
  'llama-4-scout-17b-16e-instruct': 'openai/gpt-oss-120b',
  // Groq deprecated all Llama 3.x models → mapped to new GPT-OSS models
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.1-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
}

async function generateWithOpenAICompat(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // OpenRouter recommande ces headers
      ...(baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://reseller-os.local', 'X-Title': 'Reseller OS' } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
      // Groq's GPT-OSS models return reasoning + content. We want the content only.
      // Some providers ignore this field, so it's safe to always send it.
      ...(baseUrl.includes('groq') ? { reasoning_format: 'parsed' } : {}),
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    let errMsg = ''
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson?.error?.message || errJson?.message || errJson?.error || ''
    } catch {
      errMsg = errText.slice(0, 300)
    }
    if (res.status === 401) throw new Error('Clé API invalide. Vérifiez votre clé dans Paramètres → IA.')
    if (res.status === 429) throw new Error('Quota dépassé. Attendez quelques instants.')
    if (res.status === 404) throw new Error(`Modèle "${model}" introuvable sur ce fournisseur. ${errMsg ? `Détail: ${errMsg}` : ''} Allez dans Paramètres → IA pour changer de modèle.`)
    throw new Error(`Erreur API (${res.status}): ${errMsg || errText.slice(0, 200)}`)
  }
  const data = await res.json()
  // Try standard OpenAI format first, then fallback to alternative fields
  const text = data?.choices?.[0]?.message?.content
    || data?.choices?.[0]?.message?.reasoning
    || data?.choices?.[0]?.text
    || data?.output
    || data?.output_text
  if (!text) {
    console.error('[ai/description] Empty response from API:', JSON.stringify(data).slice(0, 500))
    throw new Error('Réponse vide — le modèle n\'a rien généré. Essayez un autre modèle dans Paramètres → IA.')
  }
  return text.trim()
}

async function generateWithGemini(apiKey: string, model: string, userPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 429) throw new Error('Quota Gemini dépassé. Passez à Groq ou OpenRouter (gratuit) dans Paramètres → IA.')
    if (errText.includes('quota') || errText.includes('billing')) throw new Error('Quota Gemini atteint. Astuce : passez à Groq (gratuit) dans Paramètres → IA.')
    throw new Error(`Gemini error (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Réponse Gemini vide')
  return text.trim()
}

async function generateWithZai(userPrompt: string): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error('Réponse Z.ai vide')
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { brand, category, size, color, condition, sku, suggestedPrice, platform } = body

    if (!brand) return NextResponse.json({ error: 'Marque requise' }, { status: 400 })

    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) {
      config = await db.aIConfig.create({ data: { userId: user.id, provider: 'zai', apiKey: null, model: null } })
    }

    const conditionLabels: Record<string, string> = { 'neuf': 'Neuf avec étiquette', 'tres-bon': 'Très bon état', 'bon': 'Bon état', 'correct': 'État correct' }
    const categoryLabels: Record<string, string> = { 'vetements': 'Vêtement', 'chaussures': 'Chaussures', 'accessoires': 'Accessoire', 'luxe': 'Article de luxe', 'maison': 'Article maison' }
    const platformLabels: Record<string, string> = { 'vinted': 'Vinted', 'leboncoin': 'Leboncoin', 'ebay': 'eBay', 'vestiaire': 'Vestiaire Collective' }

    const productInfo = [
      `Marque : ${brand}`,
      `Type : ${categoryLabels[category] || category || 'article'}`,
      size && size !== '__none__' ? `Taille : ${size}` : null,
      color && color !== '__none__' ? `Couleur : ${color}` : null,
      `État : ${conditionLabels[condition] || condition || 'bon état'}`,
      suggestedPrice ? `Prix conseillé : ${suggestedPrice}€` : null,
      platform ? `Plateforme : ${platformLabels[platform] || platform}` : null,
      sku ? `SKU : ${sku}` : null,
    ].filter(Boolean).join('\n')

    const userPrompt = `Rédige une description d'annonce pour cet article :\n\n${productInfo}`

    let description: string
    const provider = config.provider
    let model = config.model || (AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.defaultModel || '')
    if (DEPRECATED_MODELS[model]) model = DEPRECATED_MODELS[model]

    const providerConfig = AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]

    if (!providerConfig) throw new Error(`Fournisseur inconnu: ${provider}`)

    if (providerConfig.type === 'zai') {
      description = await generateWithZai(userPrompt)
    } else if (providerConfig.type === 'gemini') {
      if (!config.apiKey) throw new Error('Clé API Gemini requise. Configurez-la dans Paramètres → IA.')
      description = await generateWithGemini(config.apiKey, model, userPrompt)
    } else {
      // openai_compat — fonctionne pour Groq, OpenRouter, NVIDIA, Kimi, Cerebras, DeepSeek, Mistral, OpenAI
      // For NVIDIA, fall back to nvidiaApiKey if apiKey is not set
      let apiKey = config.apiKey
      if (provider === 'nvidia' && !apiKey && config.nvidiaApiKey) {
        apiKey = config.nvidiaApiKey
      }
      if (!apiKey) throw new Error(`Clé API ${providerConfig.label} requise. Configurez-la dans Paramètres → IA.`)
      description = await generateWithOpenAICompat(providerConfig.baseUrl, apiKey, model, SYSTEM_PROMPT, userPrompt)
    }

    return NextResponse.json({ description, provider })
  } catch (error) {
    console.error('POST /api/ai/description error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur' }, { status: 500 })
  }
}
