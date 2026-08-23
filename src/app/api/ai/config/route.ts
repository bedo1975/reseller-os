import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

// Fournisseurs IA supportés
// type: "openai_compat" = API compatible OpenAI (la plupart), "gemini" = API native Gemini, "zai" = SDK Z.ai
export const AI_PROVIDERS = {
  groq: {
    label: 'Groq',
    description: 'Gratuit, ultra-rapide — GPT-OSS / Qwen (recommandé)',
    defaultModel: 'openai/gpt-oss-120b',
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b', 'groq/compound'],
    apiKeyUrl: 'https://console.groq.com/keys',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    vision: false,
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'Accès à 100+ modèles — gratuits et payants',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'qwen/qwen-2.5-72b-instruct:free'],
    apiKeyUrl: 'https://openrouter.ai/keys',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    vision: true,
  },
  nvidia: {
    label: 'NVIDIA AI',
    description: 'Gratuit — NIM API, modèles Llama et Mistral',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-70b-instruct', 'mistralai/mistral-small-24b-instruct'],
    apiKeyUrl: 'https://build.nvidia.com/',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    vision: false,
  },
  gemini: {
    label: 'Google Gemini',
    description: 'Gratuit mais activation facturation Google Cloud requise',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    free: true,
    type: 'gemini',
    baseUrl: '',
    vision: true,
  },
  kimi: {
    label: 'Kimi AI (Moonshot)',
    description: 'Gratuit — supporte la vision',
    defaultModel: 'moonshot-v1-8k-vision-preview',
    models: ['moonshot-v1-8k-vision-preview', 'moonshot-v1-32k-vision-preview', 'moonshot-v1-8k'],
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://api.moonshot.cn/v1',
    vision: true,
  },
  cerebras: {
    label: 'Cerebras AI',
    description: 'Gratuit — inference ultra-rapide (texte uniquement)',
    defaultModel: 'llama3.1-8b',
    models: ['llama3.1-8b', 'llama-3.3-70b'],
    apiKeyUrl: 'https://cerebras.ai/',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://api.cerebras.ai/v1',
    vision: false,
  },
  deepseek: {
    label: 'DeepSeek',
    description: 'Gratuit — texte uniquement (pas de vision)',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://api.deepseek.com/v1',
    vision: false,
  },
  mistral: {
    label: 'Mistral AI',
    description: 'Gratuit — texte uniquement (pas de vision)',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-7b'],
    apiKeyUrl: 'https://console.mistral.ai/api-keys/',
    free: true,
    type: 'openai_compat',
    baseUrl: 'https://api.mistral.ai/v1',
    vision: false,
  },
  openai: {
    label: 'OpenAI',
    description: 'Payant — GPT-4o-mini le moins cher',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    free: false,
    type: 'openai_compat',
    baseUrl: 'https://api.openai.com/v1',
    vision: true,
  },
  zai: {
    label: 'Z.ai (preview cloud)',
    description: 'Uniquement sur la preview Z.ai — pas de config requise',
    defaultModel: '',
    models: [],
    apiKeyUrl: '',
    free: true,
    type: 'zai',
    baseUrl: '',
    vision: true,
  },
} as const

export async function GET() {
  try {
    const user = await requireAuth()
    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) {
      config = await db.aIConfig.create({
        data: { userId: user.id, provider: 'zai', apiKey: null, model: null },
      })
    }
    return NextResponse.json({
      ...config,
      apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : null,
      hasApiKey: !!config.apiKey,
      hasReplicateApiKey: !!config.replicateApiKey,
      providers: AI_PROVIDERS,
    })
  } catch (error) {
    console.error('GET /api/ai/config error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { provider, apiKey, model, replicateApiKey: repKey } = body

    if (!provider || !AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]) {
      return NextResponse.json({ error: 'Fournisseur invalide' }, { status: 400 })
    }

    let config = await db.aIConfig.findUnique({ where: { userId: user.id } })
    if (!config) {
      config = await db.aIConfig.create({
        data: {
          userId: user.id, provider,
          apiKey: apiKey || null,
          model: model || null,
          replicateApiKey: repKey || null,
        },
      })
    } else {
      const updateData: { provider?: string; apiKey?: string | null; model?: string | null; replicateApiKey?: string | null } = {
        provider,
        model: model || null,
      }
      if (apiKey && !apiKey.startsWith('••••')) {
        updateData.apiKey = apiKey
      }
      if (provider === 'zai') {
        updateData.apiKey = null
      }
      if (repKey && !repKey.startsWith('••••')) {
        updateData.replicateApiKey = repKey
      }
      config = await db.aIConfig.update({
        where: { userId: user.id },
        data: updateData,
      })
    }

    return NextResponse.json({
      ...config,
      apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : null,
      hasApiKey: !!config.apiKey,
      providers: AI_PROVIDERS,
    })
  } catch (error) {
    console.error('PUT /api/ai/config error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
