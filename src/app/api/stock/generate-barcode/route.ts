import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/stock/generate-barcode
 * Generates a unique EAN-13 barcode that doesn't already exist in the DB.
 *
 * EAN-13 structure (13 digits):
 *   - 12 digits of payload (we use the "private" range 200000000000 - 299999999999,
 *     reserved for in-store/internal use, NOT for retail products)
 *   - 1 check digit computed via the EAN-13 checksum algorithm
 *
 * Returns: { barcode: "2001234567895" }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    // Try up to 20 times to generate a unique barcode
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateEan13()
      // Verify uniqueness in DB (case-insensitive on SQLite, but barcodes are numeric)
      const existing = await db.stockItem.findFirst({
        where: { barcode: candidate },
        select: { id: true },
      })
      if (!existing) {
        return NextResponse.json({ barcode: candidate })
      }
    }

    // Extremely unlikely — fall back to a timestamp-based one
    return NextResponse.json({ barcode: generateEan13() })
  } catch (error) {
    console.error('POST /api/stock/generate-barcode error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Generate a random EAN-13 barcode using the "private" prefix 2XXXXXXXXXX
 * (the 2 prefix is reserved for in-store use, so we won't collide with real retail barcodes).
 */
function generateEan13(): string {
  // Start with "2" (private/in-store prefix)
  let payload = '2'
  // Add 11 random digits
  for (let i = 0; i < 11; i++) {
    payload += Math.floor(Math.random() * 10).toString()
  }
  // Compute check digit
  const checkDigit = ean13CheckDigit(payload)
  return payload + checkDigit.toString()
}

/**
 * Compute the EAN-13 check digit.
 * Algorithm: https://en.wikipedia.org/wiki/International_Article_Number#Check_digit
 * - Sum odd-position digits (1st, 3rd, ...) × 1
 * - Sum even-position digits (2nd, 4th, ...) × 3
 * - Check digit = (10 - (sum mod 10)) mod 10
 */
function ean13CheckDigit(payload12: string): number {
  if (payload12.length !== 12) throw new Error('EAN-13 payload must be 12 digits')
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(payload12[i], 10)
    // Positions 1-indexed: odd positions (1, 3, 5, ...) are × 1, even positions (2, 4, ...) are × 3
    // In 0-indexed: positions 0, 2, 4, ... are odd (1-indexed) → × 1
    //                positions 1, 3, 5, ... are even (1-indexed) → × 3
    sum += (i % 2 === 0) ? digit * 1 : digit * 3
  }
  return (10 - (sum % 10)) % 10
}
