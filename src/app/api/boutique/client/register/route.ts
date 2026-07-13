import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { signClientToken, CLIENT_COOKIE_NAME } from '@/lib/boutique-client-auth'
import { notifyClientRegistration } from '@/lib/email'

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
    const client = await db.boutiqueClient.create({
      data: {
        email: emailLower,
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
      },
    })

    const token = await signClientToken(client)

    // Send welcome email
    await notifyClientRegistration(client.email, client.firstName)

    const res = NextResponse.json({
      id: client.id,
      email: client.email,
      firstName: client.firstName,
      lastName: client.lastName,
    })
    res.cookies.set(CLIENT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })
    return res
  } catch (error) {
    console.error('POST /api/boutique/client/register error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
