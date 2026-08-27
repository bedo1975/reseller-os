import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET — email settings (admin)
export async function GET() {
  try {
    await requireAdmin()
    const user = await requireAdmin()
    let settings = await db.emailSettings.findUnique({ where: { userId: user.id } })
    if (!settings) {
      settings = await db.emailSettings.create({ data: { userId: user.id } })
    }
    return NextResponse.json(settings)
  } catch (error) {
    console.error('GET /api/email-settings error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — update email settings (admin)
export async function PUT(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await req.json()
    const {
      smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure,
      fromEmail, fromName,
      templateRegister, templateValidate, templatePasswordLost, templatePasswordChanged, templateOrder, templateOrderStatus,
      templateAdminOrder, templateBackInStock, templateOrderReady,
      templateOfferAccepted, templateOfferRejected, templateAdminOffer,
    } = body

    const data: any = {}
    if (typeof smtpHost === 'string') data.smtpHost = smtpHost || null
    if (typeof smtpPort === 'number') data.smtpPort = smtpPort
    if (typeof smtpUser === 'string') data.smtpUser = smtpUser || null
    if (typeof smtpPassword === 'string') data.smtpPassword = smtpPassword || null
    if (typeof smtpSecure === 'boolean') data.smtpSecure = smtpSecure
    if (typeof fromEmail === 'string') data.fromEmail = fromEmail || null
    if (typeof fromName === 'string') data.fromName = fromName || null
    if (typeof templateRegister === 'string') data.templateRegister = templateRegister || null
    if (typeof templateValidate === 'string') data.templateValidate = templateValidate || null
    if (typeof templatePasswordLost === 'string') data.templatePasswordLost = templatePasswordLost || null
    if (typeof templatePasswordChanged === 'string') data.templatePasswordChanged = templatePasswordChanged || null
    if (typeof templateOrder === 'string') data.templateOrder = templateOrder || null
    if (typeof templateOrderStatus === 'string') data.templateOrderStatus = templateOrderStatus || null
    if (typeof templateAdminOrder === 'string') data.templateAdminOrder = templateAdminOrder || null
    if (typeof templateBackInStock === 'string') data.templateBackInStock = templateBackInStock || null
    if (typeof templateOrderReady === 'string') data.templateOrderReady = templateOrderReady || null
    if (typeof templateOfferAccepted === 'string') data.templateOfferAccepted = templateOfferAccepted || null
    if (typeof templateOfferRejected === 'string') data.templateOfferRejected = templateOfferRejected || null
    if (typeof templateAdminOffer === 'string') data.templateAdminOffer = templateAdminOffer || null

    const settings = await db.emailSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('PUT /api/email-settings error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
