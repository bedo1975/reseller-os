import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const CLIENT_JWT_SECRET = process.env.NEXTAUTH_SECRET || 'boutique-client-secret-change-me'
const COOKIE_NAME = 'boutique_client_token'

export interface ClientToken {
  id: string
  email: string
  name: string
}

export async function signClientToken(client: { id: string; email: string; firstName: string; lastName: string }): Promise<string> {
  return jwt.sign(
    { id: client.id, email: client.email, name: `${client.firstName} ${client.lastName}` },
    CLIENT_JWT_SECRET,
    { expiresIn: '30d' },
  )
}

export async function getClientFromToken(): Promise<ClientToken | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const decoded = jwt.verify(token, CLIENT_JWT_SECRET) as ClientToken
    // Verify the client still exists
    const client = await db.boutiqueClient.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    if (!client) return null
    return {
      id: client.id,
      email: client.email,
      name: `${client.firstName} ${client.lastName}`,
    }
  } catch {
    return null
  }
}

export async function requireClient(): Promise<ClientToken> {
  const client = await getClientFromToken()
  if (!client) throw new Error('UNAUTHORIZED_CLIENT')
  return client
}

export const CLIENT_COOKIE_NAME = COOKIE_NAME
