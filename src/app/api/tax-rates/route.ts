import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

// Catégories d'activité avec taux URSSAF par défaut
export const ACTIVITY_TYPES = {
  achat_revente: {
    label: 'Achat / Revente',
    defaultRate: 12.3,
    description: 'Vente de marchandises, revente de biens (Vinted, Leboncoin, eBay...)',
  },
  prestation_service: {
    label: 'Prestation de services',
    defaultRate: 21.2,
    description: 'Services commerciaux, artisanale commerciale',
  },
  autre_prestation: {
    label: 'Autre prestation de services',
    defaultRate: 25.6,
    description: 'Autres prestations non commerciales',
  },
  profession_liberale: {
    label: 'Profession libérale',
    defaultRate: 23.2,
    description: 'Activités libérales réglementées ou non',
  },
  location_meuble: {
    label: 'Location de meublé saisonnier',
    defaultRate: 6.0,
    description: 'Location meublée de tourisme classé (paramétrable)',
  },
} as const

export async function GET() {
  try {
    const user = await requireAuth()
    let settings = await db.taxSettings.findUnique({ where: { userId: user.id } })
    if (!settings) {
      settings = await db.taxSettings.create({
        data: { userId: user.id, activityType: 'achat_revente', taxRate: 12.3 },
      })
    }
    return NextResponse.json({
      ...settings,
      activityTypes: ACTIVITY_TYPES,
    })
  } catch (error) {
    console.error('GET /api/tax-rates error:', error)
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
    const { activityType, taxRate } = body

    if (!activityType || !ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES]) {
      return NextResponse.json({ error: 'Type d\'activité invalide' }, { status: 400 })
    }

    const rate = parseFloat(taxRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: 'Taux invalide (0-100)' }, { status: 400 })
    }

    let settings = await db.taxSettings.findUnique({ where: { userId: user.id } })
    if (!settings) {
      settings = await db.taxSettings.create({
        data: { userId: user.id, activityType, taxRate: rate },
      })
    } else {
      settings = await db.taxSettings.update({
        where: { userId: user.id },
        data: { activityType, taxRate: rate },
      })
    }

    return NextResponse.json({
      ...settings,
      activityTypes: ACTIVITY_TYPES,
    })
  } catch (error) {
    console.error('PUT /api/tax-rates error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
