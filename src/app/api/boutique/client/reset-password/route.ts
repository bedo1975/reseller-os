import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyPasswordChanged } from '@/lib/email'
import bcrypt from 'bcryptjs'

/**
 * POST /api/boutique/client/reset-password
 * Public — resets the password using a valid token.
 *
 * Body: { token: string, password: string }
 *
 * The confirmation email uses the admin's custom `templatePasswordChanged`
 * if defined as HTML, otherwise falls back to the same buildEmailTemplate()
 * wrapper used by the other notification emails.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
    }

    // Find the client by token
    const client = await db.boutiqueClient.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré' }, { status: 400 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update the client
    await db.boutiqueClient.update({
      where: { id: client.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    // Send confirmation email using the shared helper (respects admin custom template)
    await notifyPasswordChanged(client.email, client.firstName)

    return NextResponse.json({ ok: true, message: 'Mot de passe modifié avec succès' })
  } catch (error) {
    console.error('POST /api/boutique/client/reset-password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
