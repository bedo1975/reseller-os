import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/client/validate-account
 * Public — validates an email using a token sent via email.
 *
 * Body: { token: string }
 *
 * On success: marks the account as emailValidated=true, clears the token.
 * On failure: returns 400 with an error message.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Token de validation requis' }, { status: 400 })
    }

    // Find the client by validation token
    const client = await db.boutiqueClient.findFirst({
      where: { validationToken: token },
    })

    if (!client) {
      return NextResponse.json({
        error: 'Lien de validation invalide. Votre compte est peut-être déjà validé.',
      }, { status: 400 })
    }

    // Update the client — set validated, clear the token
    await db.boutiqueClient.update({
      where: { id: client.id },
      data: {
        emailValidated: true,
        validationToken: null,
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Compte validé avec succès',
      clientEmail: client.email,
    })
  } catch (error) {
    console.error('POST /api/boutique/client/validate-account error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
