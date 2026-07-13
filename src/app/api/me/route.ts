import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'

// Returns the current authenticated user's profile (id, name, email, role).
// Used by the client to know which modules to show/hide.
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    console.error('GET /api/me error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
