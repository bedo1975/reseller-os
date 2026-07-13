import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// PUBLIC endpoint — but ONLY works if NO users exist yet.
// Used by the setup wizard on first launch to bootstrap the first admin account.
export async function POST(req: NextRequest) {
  try {
    const userCount = await db.user.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Un administrateur existe déjà. Veuillez vous connecter.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nom, email et mot de passe requis' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: 'admin', // first user is always admin
      },
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'Administrateur créé avec succès',
    })
  } catch (error) {
    console.error('POST /api/users/setup error:', error)
    return NextResponse.json({ error: 'Erreur lors de la configuration' }, { status: 500 })
  }
}
