import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
  role: string
}

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession()
  if (!session?.user) return null
  return session.user as SessionUser
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') throw new Error('FORBIDDEN')
  return user
}

// Returns a 401 / 403 NextResponse-friendly error or null if OK
export function authError(message: string) {
  const status = message === 'FORBIDDEN' ? 403 : 401
  const text = message === 'FORBIDDEN' ? 'Accès refusé (admin requis)' : 'Non authentifié'
  return { status, text }
}
