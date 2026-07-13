import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUBLIC endpoint — used by login & setup pages to know if a setup is needed.
// Never returns any sensitive info, only the count.
export async function GET() {
  try {
    const count = await db.user.count()
    return NextResponse.json({ count })
  } catch (error) {
    console.error('GET /api/users/count error:', error)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
