import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /icon.svg
 * Dynamic favicon for the boutique — generates an SVG with the configured letter
 * and background color (read from BoutiqueSettings).
 *
 * Next.js recognizes /icon.svg as the favicon for the root route group.
 * This file is the boutique's favicon; /admin/layout.tsx overrides it with
 * a static icon for the admin.
 *
 * No auth required — this is a public icon served on every page.
 */
export async function GET() {
  try {
    const settings = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })

    // Resolve letter: explicit faviconLetter → first letter of logoText → fallback "B"
    let letter = 'B'
    if (settings?.faviconLetter && settings.faviconLetter.trim()) {
      letter = settings.faviconLetter.trim().charAt(0).toUpperCase()
    } else if (settings?.logoText && settings.logoText.trim()) {
      letter = settings.logoText.trim().charAt(0).toUpperCase()
    }

    // Resolve background color: explicit faviconBgColor → primaryColor → fallback "007bff"
    // Colors are stored without leading #, e.g. "007bff" or "B" → we add the # here.
    let bgColor = '#007bff'
    const raw = settings?.faviconBgColor || settings?.primaryColor
    if (raw && /^[0-9a-fA-F]{3,8}$/.test(raw)) {
      bgColor = '#' + raw
    }

    // SVG: 64x64 square with colored background and centered letter.
    // We use a system font stack; the letter is rendered bold for legibility at small sizes.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${bgColor}"/>
  <text x="32" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="42" font-weight="700" fill="white" text-anchor="middle">${escapeXml(letter)}</text>
</svg>`

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('GET /icon.svg error:', error)
    // Fallback: blue square with "B" (no DB dependency)
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#007bff"/>
  <text x="32" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="42" font-weight="700" fill="white" text-anchor="middle">B</text>
</svg>`
    return new NextResponse(fallback, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' },
    })
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
