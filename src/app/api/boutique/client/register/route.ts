import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyAccountValidation } from '@/lib/email'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { firstName, lastName, email, password, phone } = body

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'Tous les champs requis' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Mot de passe trop court (6 caractères min)' }, { status: 400 })
    }

    const emailLower = email.toLowerCase().trim()
    const existing = await db.boutiqueClient.findUnique({ where: { email: emailLower } })
    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate validation token (valid for 24h)
    const validationToken = crypto.randomBytes(32).toString('hex')

    const client = await db.boutiqueClient.create({
      data: {
        email: emailLower,
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        emailValidated: false,
        validationToken,
      },
    })

    // Build validation URL + send validation email
    // Note: we do NOT auto-login the user — they must validate their email first.
    // The link points to the GET /api/boutique/client/validate-account route
    // which validates directly and redirects to /boutique/connexion?validated=1
    const settings = await getBoutiqueSettings()
    const siteUrl = settings.shareSiteUrl || ''
    const validationUrl = siteUrl
      ? `${siteUrl}/api/boutique/client/validate-account?token=${validationToken}`
      : ''

    await notifyAccountValidation(client.email, client.firstName, validationUrl)

    return NextResponse.json({
      ok: true,
      needsValidation: true,
      message: 'Compte créé ! Un email de validation vous a été envoyé. Veuillez cliquer sur le lien dans l\'email pour activer votre compte.',
      clientEmail: client.email,
    })
  } catch (error) {
    console.error('POST /api/boutique/client/register error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
