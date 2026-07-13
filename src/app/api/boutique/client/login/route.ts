import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { signClientToken, CLIENT_COOKIE_NAME } from '@/lib/boutique-client-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }

    const emailLower = email.toLowerCase().trim()
    const client = await db.boutiqueClient.findUnique({ where: { email: emailLower } })
    if (!client) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, client.password)
    if (!valid) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 })
    }

    const token = await signClientToken(client)
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
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })
    return res
  } catch (error) {
    console.error('POST /api/boutique/client/login error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
