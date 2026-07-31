import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

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

// ── Shared email template builder ─────────────────────────────────────────
function buildEmailTemplate(opts: {
  title: string
  headerColor: string
  firstName: string
  bodyHtml: string
  siteUrl?: string
  buttonText?: string
  buttonUrl?: string
  logoText?: string
}): { html: string; text: string } {
  const { title, headerColor, firstName, bodyHtml, siteUrl, buttonText, buttonUrl, logoText } = opts

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;background:#f3f4f6;padding:20px;margin:0;">
<table style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:${headerColor};color:#fff;padding:20px 24px;text-align:center;">
<h1 style="margin:0;font-size:20px;font-weight:600;">${title}</h1>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 12px 0;">Bonjour ${firstName},</p>
${bodyHtml}
${buttonText && buttonUrl ? `<a href="${buttonUrl}" style="display:inline-block;background:${headerColor};color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;margin-top:12px;">${buttonText}</a>` : ''}
<p style="margin-top:20px;font-size:12px;color:#9ca3af;">À bientôt sur ${logoText || 'notre boutique'} !</p>
</td></tr>
</table>
</body></html>`

  return { html, text: '' }
}

export async function notifyNewOrder(clientEmail: string, clientFirstName: string, orderId: string, total: number) {
  try {
    console.log('[email] notifyNewOrder triggered:', orderId, 'to', clientEmail)
    const config = await getEmailConfig()
    const settings = await getBoutiqueSettings()
    const siteUrl = settings.shareSiteUrl || ''
    const logoText = settings.logoText || 'Boutique'

    // Use custom template if defined, otherwise use default
    const template = config?.templateOrder || null
    const defaultText = `Bonjour ${clientFirstName},\n\nMerci pour votre commande !\n\nNuméro de commande : ${orderId}\nMontant total : ${total.toFixed(2)} €\n\nVous pouvez suivre votre commande dans votre espace client.\n${siteUrl ? siteUrl + '/boutique/compte/commandes' : ''}\n\nÀ bientôt !`
    const text = applyTemplate(template, defaultText, { firstName: clientFirstName, orderId, total: total.toFixed(2) + ' €' })

    // If template is HTML, use it directly; otherwise use our standard HTML template
    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Template is HTML — use it with appended button
      const followButton = siteUrl
        ? `<div style="margin-top:16px;"><a href="${siteUrl}/boutique/compte/commandes" style="display:inline-block;background:#007bff;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;">Suivre ma commande →</a></div>`
        : ''
      html = template + followButton
    } else {
      // Use standard HTML template
      const bodyHtml = `
<p style="margin:0 0 12px 0;">Nous avons bien reçu votre commande et nous vous en remercions !</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Numéro de commande</p>
<p style="margin:0 0 12px 0;font-family:monospace;font-weight:600;font-size:15px;">${orderId}</p>
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Montant total</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#007bff;">${total.toFixed(2)} €</p>
</div>`

      const result = buildEmailTemplate({
        title: 'Merci pour votre commande !',
        headerColor: '#007bff',
        firstName: clientFirstName,
        bodyHtml,
        siteUrl,
        buttonText: siteUrl ? 'Suivre ma commande →' : undefined,
        buttonUrl: siteUrl ? `${siteUrl}/boutique/compte/commandes` : undefined,
        logoText,
      })
      html = result.html
    }

    await sendEmail({
      to: clientEmail,
      subject: `Confirmation de commande ${orderId}`,
      text,
      html,
    })

    // Also notify admin with HTML template
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    if (adminUser?.email) {
      console.log('[email] notifyNewOrder: also notifying admin:', adminUser.email)

      const adminBodyHtml = `
<p style="margin:0 0 12px 0;">Une nouvelle commande vient d'être passée sur la boutique.</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Client</p>
<p style="margin:0 0 12px 0;font-weight:600;">${clientFirstName}</p>
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Commande</p>
<p style="margin:0 0 12px 0;font-family:monospace;font-weight:600;">${orderId}</p>
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Montant</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#10b981;">${total.toFixed(2)} €</p>
</div>`

      const { html: adminHtml } = buildEmailTemplate({
        title: '🛒 Nouvelle commande boutique',
        headerColor: '#10b981',
        firstName: adminUser.name || 'Admin',
        bodyHtml: adminBodyHtml,
        siteUrl,
        buttonText: siteUrl ? 'Traiter la commande →' : undefined,
        buttonUrl: siteUrl ? `${siteUrl}/?module=boutique-admin` : undefined,
        logoText,
      })

      await sendEmail({
        to: adminUser.email,
        subject: `🛒 Nouvelle commande ${orderId} — ${total.toFixed(2)} €`,
        text: `Nouvelle commande reçue.\n\nClient : ${clientFirstName}\nCommande : ${orderId}\nMontant : ${total.toFixed(2)} €`,
        html: adminHtml,
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
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''

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

    const defaultText = `Bonjour ${clientFirstName},\n\nLe statut de votre commande ${orderId} a été mis à jour : ${statusLabel}\n\n${siteUrl ? 'Suivez votre commande : ' + siteUrl + '/boutique/compte/commandes' : ''}${trackingText}`
    const text = applyTemplate(
      template,
      defaultText,
      { firstName: clientFirstName, orderId, status: statusLabel },
    )

    // Build the HTML body using the same template as notifyNewOrder
    const bodyHtml = `
<p style="margin:0 0 12px 0;">Le statut de votre commande a \u00e9t\u00e9 mis \u00e0 jour.</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Commande</p>
<p style="margin:0 0 12px 0;font-family:monospace;font-weight:600;font-size:15px;">${orderId}</p>
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Nouveau statut</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#007bff;">${statusLabel}</p>
</div>
${trackingHtml}`

    const { html } = buildEmailTemplate({
      title: `Mise \u00e0 jour \u2014 ${statusLabel}`,
      headerColor: '#007bff',
      firstName: clientFirstName,
      bodyHtml,
      siteUrl,
      buttonText: siteUrl ? 'Suivre ma commande \u2192' : undefined,
      buttonUrl: siteUrl ? `${siteUrl}/boutique/compte/commandes` : undefined,
      logoText: bs.logoText || 'Boutique',
    })

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
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''

    const text = `Bienvenue ${clientFirstName} !\n\nVotre compte a été créé avec succès.\n\nVous pouvez maintenant passer commande, suivre vos commandes et nous contacter via la messagerie.\n${siteUrl ? 'Accédez à votre compte : ' + siteUrl + '/boutique/compte' : ''}\n\nÀ bientôt !`

    const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#1a1a1a;background:#f3f4f6;padding:20px;margin:0;">
<table style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#10b981;color:#fff;padding:20px;text-align:center;"><h1 style="margin:0;font-size:20px;">Bienvenue ! 🎉</h1></td></tr>
<tr><td style="padding:24px;">
<p>Bonjour ${clientFirstName},</p>
<p>Votre compte a été créé avec succès. Vous pouvez maintenant :</p>
<ul style="margin:8px 0;padding-left:20px;">
<li>🛍️ Passer commande sur notre boutique</li>
<li>📦 Suivre vos commandes en temps réel</li>
<li>💬 Nous contacter via la messagerie</li>
</ul>
${siteUrl ? `<a href="${siteUrl}/boutique/compte" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;font-size:14px;margin-top:12px;">Accéder à mon compte →</a>` : ''}
<p style="margin-top:16px;font-size:12px;color:#9ca3af;">À bientôt sur ${bs.logoText || 'notre boutique'} !</p>
</td></tr>
</table>
</body></html>`

    await sendEmail({
      to: clientEmail,
      subject: 'Bienvenue !',
      text,
      html,
    })
  } catch (e: any) {
    console.error('[email] notifyClientRegistration error:', e?.message)
  }
}
