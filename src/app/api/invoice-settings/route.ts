import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

// GET — Récupère les paramètres de facturation de l'utilisateur connecté
export async function GET() {
  try {
    const user = await requireAuth()
    let settings = await db.invoiceSettings.findUnique({ where: { userId: user.id } })
    if (!settings) {
      // Auto-crée avec des valeurs par défaut
      settings = await db.invoiceSettings.create({
        data: {
          userId: user.id,
          companyName: user.name || 'Ma Société',
          address: '',
          postalCode: '',
          city: '',
        },
      })
    }
    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('GET /api/invoice-settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — Met à jour les paramètres de facturation
export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const {
      companyName, address, postalCode, city, country,
      email, phone, siret, rcs,
      vatEnabled, vatNumber, vatRate, vatExemptionText,
      invoicePrefix, invoicePadLength,
      legalMentions,
    } = body

    if (!companyName) {
      return NextResponse.json({ error: 'Nom de société requis' }, { status: 400 })
    }

    let settings = await db.invoiceSettings.findUnique({ where: { userId: user.id } })
    if (!settings) {
      settings = await db.invoiceSettings.create({
        data: {
          userId: user.id,
          companyName: companyName.trim(),
          address: address?.trim() || '',
          postalCode: postalCode?.trim() || '',
          city: city?.trim() || '',
        },
      })
    }

    settings = await db.invoiceSettings.update({
      where: { userId: user.id },
      data: {
        companyName: companyName.trim(),
        address: address?.trim() || '',
        postalCode: postalCode?.trim() || '',
        city: city?.trim() || '',
        country: country?.trim() || 'France',
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        siret: siret?.trim() || null,
        rcs: rcs?.trim() || null,
        vatEnabled: !!vatEnabled,
        vatNumber: vatEnabled ? (vatNumber?.trim() || null) : null,
        vatRate: vatEnabled ? (parseFloat(vatRate) || 20.0) : 20.0,
        vatExemptionText: vatExemptionText?.trim() || 'TVA non applicable, art. 293 B du CGI — franchise en base',
        invoicePrefix: invoicePrefix?.trim() || 'F-{YEAR}-',
        invoicePadLength: parseInt(invoicePadLength) || 3,
        legalMentions: legalMentions?.trim() || null,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    console.error('PUT /api/invoice-settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
