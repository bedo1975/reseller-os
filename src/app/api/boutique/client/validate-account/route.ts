import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/client/validate-account?token=xxx
 * Public — validates an email using a token sent via email.
 *
 * This is the PRIMARY entry point — the email link points directly here.
 * After validation, redirects to /boutique/connexion with a status param:
 *   - ?validated=1         → success
 *   - ?validation_error=1  → invalid/expired token
 *
 * Using a GET + redirect approach (instead of a separate page that calls
 * the API) is more robust: there's no client-side JS needed, no Suspense
 * boundary, no fetch call that could fail silently.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  console.log('[validate-account] GET received, token:', token ? `${token.substring(0, 12)}...` : 'null')

  if (!token) {
    console.log('[validate-account] No token provided')
    return NextResponse.redirect(new URL('/boutique/connexion?validation_error=1', req.url))
  }

  try {
    // Find the client by validation token
    const client = await db.boutiqueClient.findFirst({
      where: { validationToken: token },
    })

    console.log('[validate-account] Client found:', client ? client.email : 'null')

    if (!client) {
      console.log('[validate-account] No client matches this token (already validated or invalid)')
      return NextResponse.redirect(new URL('/boutique/connexion?validation_error=1', req.url))
    }

    // Update the client — set validated, clear the token
    await db.boutiqueClient.update({
      where: { id: client.id },
      data: {
        emailValidated: true,
        validationToken: null,
      },
    })

    console.log('[validate-account] ✓ Account validated for:', client.email)
    return NextResponse.redirect(new URL('/boutique/connexion?validated=1', req.url))
  } catch (error) {
    console.error('[validate-account] Error:', error)
    return NextResponse.redirect(new URL('/boutique/connexion?validation_error=1', req.url))
  }
}

/**
 * POST /api/boutique/client/validate-account
 * Public — validates an email using a token sent via email.
 *
 * Body: { token: string }
 *
 * Kept for backward-compat with the /boutique/valider-compte page.
 * The GET handler above is now the primary entry point.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token } = body

    console.log('[validate-account] POST received, token:', token ? `${token.substring(0, 12)}...` : 'null')

    if (!token) {
      return NextResponse.json({ error: 'Token de validation requis' }, { status: 400 })
    }

    // Find the client by validation token
    const client = await db.boutiqueClient.findFirst({
      where: { validationToken: token },
    })

    console.log('[validate-account] Client found:', client ? client.email : 'null')

    if (!client) {
      return NextResponse.json({
        error: 'Lien de validation invalide. Votre compte est peut-être déjà validé.',
      }, { status: 400 })
    }

    // Update the client — set validated, clear the token
    await db.boutiqueClient.update({
      where: { id: client.id },
      data: {
        emailValidated: true,
        validationToken: null,
      },
    })

    console.log('[validate-account] ✓ Account validated for:', client.email)
    return NextResponse.json({
      ok: true,
      message: 'Compte validé avec succès',
      clientEmail: client.email,
    })
  } catch (error) {
    console.error('POST /api/boutique/client/validate-account error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
