import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClientFromToken } from '@/lib/boutique-client-auth'

// GET — current client info
export async function GET() {
  try {
    const token = await getClientFromToken()
    if (!token) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }
    const client = await db.boutiqueClient.findUnique({
      where: { id: token.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        postalCode: true,
        city: true,
        country: true,
        newsletter: true,
        createdAt: true,
      },
    })
    if (!client) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }
    return NextResponse.json(client)
  } catch (error) {
    console.error('GET /api/boutique/client/me error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — update profile
export async function PUT(req: NextRequest) {
  try {
    const token = await getClientFromToken()
    if (!token) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }
    const body = await req.json()
    const { firstName, lastName, phone, address, postalCode, city, country, newsletter } = body

    const data: any = {}
    if (typeof firstName === 'string') data.firstName = firstName.trim()
    if (typeof lastName === 'string') data.lastName = lastName.trim()
    if (typeof phone === 'string') data.phone = phone.trim() || null
    if (typeof address === 'string') data.address = address.trim() || null
    if (typeof postalCode === 'string') data.postalCode = postalCode.trim() || null
    if (typeof city === 'string') data.city = city.trim() || null
    if (typeof country === 'string') data.country = country.trim()
    if (typeof newsletter === 'boolean') data.newsletter = newsletter

    const updated = await db.boutiqueClient.update({
      where: { id: token.id },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, address: true, postalCode: true, city: true, country: true,
        newsletter: true, createdAt: true,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/boutique/client/me error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
