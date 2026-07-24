import { db } from '@/lib/db'

/**
 * Email helper — sends emails using configured SMTP settings (nodemailer).
 * If SMTP is not configured or email fails, it silently skips (no crash).
 * Returns true if email was sent, false otherwise.
 */

let nodemailer: any = null
async function getNodemailer() {
  if (!nodemailer) {
    try {
      nodemailer = await import('nodemailer')
    } catch {
      return null
    }
  }
  return nodemailer
}

async function getEmailConfig() {
  const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
  if (!adminUser) return null
  const settings = await db.emailSettings.findUnique({ where: { userId: adminUser.id } })
  if (!settings || !settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
    return null
  }
  return settings
}

function applyTemplate(template: string | null, defaultText: string, vars: Record<string, string>): string {
  let text = template || defaultText
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return text
}

/**
 * If the template contains HTML tags, treat it as HTML.
 * Otherwise, convert plain text newlines to <br> for email rendering.
 */
function asHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text // already HTML
  }
  return text.replace(/\n/g, '<br>')
}

export interface SendEmailParams {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<boolean> {
  try {
    const config = await getEmailConfig()
    if (!config) {
      console.log('[email] SMTP not configured or incomplete. Skipping email to', to)
      return false
    }

    const mailer = await getNodemailer()
    if (!mailer) {
      console.log('[email] nodemailer not installed. Run: npm install nodemailer. Skipping email to', to)
      return false
    }

    console.log(`[email] Connecting to ${config.smtpHost}:${config.smtpPort} (secure: ${config.smtpSecure})`)

    const transporter = mailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    })

    // Verify connection before sending
    await transporter.verify()
    console.log('[email] SMTP connection verified OK')

    const fromEmail = config.fromEmail || config.smtpUser
    const fromName = config.fromName || 'DBoxPro'

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    })

    console.log(`[email] ✓ Sent to ${to}: ${subject} (messageId: ${info.messageId || 'n/a'})`)
    return true
  } catch (error: any) {
    console.error('[email] ✗ Failed to send:', error?.message || error?.code || 'unknown error')
    if (error?.code) console.error('[email] Error code:', error.code)
    return false
  }
}

// ── Notification helpers ────────────────────────────────────────────────

export async function notifyNewClientMessage(clientId: string, subject: string, body: string) {
  try {
    console.log('[email] notifyNewClientMessage triggered for client:', clientId)
    const client = await db.boutiqueClient.findUnique({ where: { id: clientId } })
    if (!client?.email) {
      console.log('[email] notifyNewClientMessage: no client email, skipping')
      return
    }

    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    const adminEmail = adminUser?.email || null
    if (!adminEmail) {
      console.log('[email] notifyNewClientMessage: no admin email found, skipping')
      return
    }
    console.log('[email] notifyNewClientMessage: sending to admin:', adminEmail)

    await sendEmail({
      to: adminEmail,
      subject: `Nouveau message de ${client.firstName} ${client.lastName}`,
      text: `Vous avez reçu un nouveau message d'un client.\n\nDe : ${client.firstName} ${client.lastName} (${client.email})\nSujet : ${subject}\n\nMessage :\n${body}\n\nConnectez-vous au back-office pour répondre.`,
    })
  } catch (e: any) {
    console.error('[email] notifyNewClientMessage error:', e?.message)
  }
}

export async function notifyAdminReply(clientId: string, subject: string, body: string) {
  try {
    console.log('[email] notifyAdminReply triggered for client:', clientId)
    const client = await db.boutiqueClient.findUnique({ where: { id: clientId } })
    if (!client?.email) {
      console.log('[email] notifyAdminReply: no client email, skipping')
      return
    }
    console.log('[email] notifyAdminReply: sending to client:', client.email)

    const config = await getEmailConfig()
    const template = config?.templateOrderStatus || null
    const text = applyTemplate(
      template,
      `Bonjour ${client.firstName},\n\nVous avez reçu une réponse de notre équipe :\n\nSujet : ${subject}\n\n${body}\n\nConnectez-vous à votre compte pour voir la conversation complète.`,
      { firstName: client.firstName, lastName: client.lastName, email: client.email },
    )

    await sendEmail({
      to: client.email,
      subject: `Réponse à votre message : ${subject}`,
      text,
      html: asHtml(text),
    })
  } catch (e: any) {
    console.error('[email] notifyAdminReply error:', e?.message)
  }
}

export async function notifyNewOrder(clientEmail: string, clientFirstName: string, orderId: string, total: number) {
  try {
    console.log('[email] notifyNewOrder triggered:', orderId, 'to', clientEmail)
    const config = await getEmailConfig()
    const template = config?.templateOrder || null
    const text = applyTemplate(
      template,
      `Bonjour ${clientFirstName},\n\nMerci pour votre commande !\n\nNuméro de commande : ${orderId}\nMontant total : ${total.toFixed(2)} €\n\nVous pouvez suivre votre commande dans votre espace client.\n\nÀ bientôt !`,
      { firstName: clientFirstName, orderId, total: total.toFixed(2) + ' €' },
    )

    await sendEmail({
      to: clientEmail,
      subject: `Confirmation de commande ${orderId}`,
      text,
      html: asHtml(text),
    })

    // Also notify admin
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    if (adminUser?.email) {
      console.log('[email] notifyNewOrder: also notifying admin:', adminUser.email)
      await sendEmail({
        to: adminUser.email,
        subject: `Nouvelle commande boutique ${orderId}`,
        text: `Nouvelle commande reçue.\n\nClient : ${clientFirstName}\nCommande : ${orderId}\nMontant : ${total.toFixed(2)} €\n\nConnectez-vous au back-office pour la traiter.`,
      })
    }
  } catch (e: any) {
    console.error('[email] notifyNewOrder error:', e?.message)
  }
}

export async function notifyOrderStatusChange(
  clientEmail: string,
  clientFirstName: string,
  orderId: string,
  status: string,
  trackingNumber?: string | null,
  carrier?: string | null,
) {
  try {
    console.log('[email] notifyOrderStatusChange triggered:', orderId, 'status:', status, 'to', clientEmail)
    const statusLabels: Record<string, string> = {
      pending: 'En attente',
      paid: 'Payée',
      preparation: 'En préparation',
      shipped: 'Expédiée',
      delivered: 'Livrée',
      cancelled: 'Annulée',
    }
    const statusLabel = statusLabels[status] || status

    const config = await getEmailConfig()
    const template = config?.templateOrderStatus || null

    // Build tracking info if shipped with tracking number
    let trackingText = ''
    let trackingHtml = ''
    if (status === 'shipped' && trackingNumber) {
      const carrierLabel = carrier || 'transporteur'
      trackingText = `\n\nNuméro de suivi : ${trackingNumber}\nTransporteur : ${carrierLabel}`

      // Try to build a tracking URL from carrier Attribute
      let trackingUrl = ''
      try {
        const carrierAttr = await db.attribute.findFirst({
          where: { type: 'carrier', code: carrier || '' },
          select: { trackingUrl: true, value: true },
        })
        if (carrierAttr?.trackingUrl && carrierAttr.trackingUrl.includes('{tracking}')) {
          trackingUrl = carrierAttr.trackingUrl.replace('{tracking}', trackingNumber)
        }
      } catch {}

      trackingHtml = `
        <div style="background:#e7f1ff;border:1px solid #b3d7ff;border-radius:8px;padding:16px;margin-top:16px;">
          <p style="margin:0 0 8px 0;font-weight:600;color:#0056b3;">📦 Suivi de votre colis</p>
          <p style="margin:0 0 4px 0;font-size:14px;color:#333;">Transporteur : <strong>${carrierLabel}</strong></p>
          <p style="margin:0 0 8px 0;font-size:14px;color:#333;">Numéro de suivi : <strong style="font-family:monospace;">${trackingNumber}</strong></p>
          ${trackingUrl
            ? `<a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#007bff;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;">Suivre mon colis →</a>`
            : ''
          }
        </div>`
    }

    const defaultText = `Bonjour ${clientFirstName},\n\nLe statut de votre commande ${orderId} a été mis à jour : ${statusLabel}\n\nConnectez-vous à votre compte pour plus de détails.${trackingText}`
    const text = applyTemplate(
      template,
      defaultText,
      { firstName: clientFirstName, orderId, status: statusLabel },
    )

    let html = asHtml(text)
    // If template is HTML, append tracking HTML after the template content
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      html = html + trackingHtml
    } else {
      // Plain text template — convert tracking text too
      html = html + trackingHtml
    }

    await sendEmail({
      to: clientEmail,
      subject: `Mise à jour commande ${orderId} — ${statusLabel}`,
      text,
      html,
    })
  } catch (e: any) {
    console.error('[email] notifyOrderStatusChange error:', e?.message)
  }
}

export async function notifyClientRegistration(clientEmail: string, clientFirstName: string) {
  try {
    console.log('[email] notifyClientRegistration triggered:', clientEmail)
    const config = await getEmailConfig()
    const template = config?.templateRegister || null
    const text = applyTemplate(
      template,
      `Bienvenue ${clientFirstName} !\n\nVotre compte a été créé avec succès.\n\nVous pouvez maintenant passer commande, suivre vos commandes et nous contacter via la messagerie.\n\nÀ bientôt !`,
      { firstName: clientFirstName, email: clientEmail },
    )

    await sendEmail({
      to: clientEmail,
      subject: 'Bienvenue !',
      text,
      html: asHtml(text),
    })
  } catch (e: any) {
    console.error('[email] notifyClientRegistration error:', e?.message)
  }
}
