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

/**
 * Backward-compat: convert any relative URLs in the template to absolute URLs.
 * Email clients cannot resolve relative URLs like "/boutique/connexion" — the
 * link simply does nothing when clicked. This catches old saved templates that
 * still contain relative paths and fixes them at send-time.
 *
 * Handles both single-quote and double-quote href attributes, and only touches
 * paths starting with "/boutique/" (the only public-facing routes used in emails).
 */
function migrateRelativeUrls(html: string, siteUrl: string): string {
  if (!siteUrl) return html
  // Remove trailing slash from siteUrl to avoid double-slashes
  const base = siteUrl.replace(/\/+$/, '')
  // Match href="/boutique/..." or href='/boutique/...' (also href=/boutique/... without quotes)
  return html
    .replace(/(href\s*=\s*)(["']?)\/boutique\//gi, `$1$2${base}/boutique/`)
    .replace(/(href\s*=\s*)(["']?)\/boutique$/gi, `$1$2${base}/boutique`)
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

  // Handle empty firstName gracefully — produces "Bonjour," instead of "Bonjour ,"
  const greeting = firstName && firstName.trim() ? `Bonjour ${firstName.trim()},` : 'Bonjour,'

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;background:#f3f4f6;padding:20px;margin:0;">
<table style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:${headerColor};color:#fff;padding:20px 24px;text-align:center;">
<h1 style="margin:0;font-size:20px;font-weight:600;">${title}</h1>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 12px 0;">${greeting}</p>
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

    // If template is HTML, use it directly with variables replaced; otherwise use our standard HTML template
    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Template is HTML — replace variables {firstName}, {orderId}, {total}, {ordersUrl} etc.
      const ordersUrl = siteUrl ? `${siteUrl}/boutique/compte/commandes` : ''
      let processedTemplate = template
      const vars: Record<string, string> = {
        firstName: clientFirstName,
        orderId,
        total: total.toFixed(2) + ' €',
        email: clientEmail,
        ordersUrl,
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl)
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

      // Use the admin-specific custom template if defined as HTML
      const adminTemplate = config?.templateAdminOrder || null
      const adminUrl = siteUrl ? `${siteUrl}/?module=boutique-admin` : ''

      let adminHtml: string
      if (adminTemplate && /<[a-z][\s\S]*>/i.test(adminTemplate)) {
        let processedTemplate = adminTemplate
        const adminVars: Record<string, string> = {
          firstName: adminUser.name || 'Admin',
          clientFirstName,
          orderId,
          total: total.toFixed(2) + ' €',
          email: clientEmail,
          adminUrl,
        }
        for (const [key, value] of Object.entries(adminVars)) {
          processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
        }
        adminHtml = migrateRelativeUrls(processedTemplate, siteUrl)
      } else {
        // Default HTML for admin — uses green header (semantic: "new revenue" notification)
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

        const { html: defaultAdminHtml } = buildEmailTemplate({
          title: '🛒 Nouvelle commande boutique',
          headerColor: '#10b981',
          firstName: adminUser.name || 'Admin',
          bodyHtml: adminBodyHtml,
          siteUrl,
          buttonText: adminUrl ? 'Traiter la commande →' : undefined,
          buttonUrl: adminUrl || undefined,
          logoText,
        })
        adminHtml = defaultAdminHtml
      }

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

    // If custom template is HTML, use it with variables replaced; otherwise use standard template
    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Template is HTML — replace variables {firstName}, {orderId}, {status}, {ordersUrl}
      const ordersUrl = siteUrl ? `${siteUrl}/boutique/compte/commandes` : ''
      let processedTemplate = template
      const vars: Record<string, string> = {
        firstName: clientFirstName,
        orderId,
        status: statusLabel,
        ordersUrl,
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl) + trackingHtml
    } else {
      // Use standard HTML template
      const bodyHtml = `
<p style="margin:0 0 12px 0;">Le statut de votre commande a été mis à jour.</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Commande</p>
<p style="margin:0 0 12px 0;font-family:monospace;font-weight:600;font-size:15px;">${orderId}</p>
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Nouveau statut</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#007bff;">${statusLabel}</p>
</div>
${trackingHtml}`

      const result = buildEmailTemplate({
        title: `Mise à jour — ${statusLabel}`,
        headerColor: '#007bff',
        firstName: clientFirstName,
        bodyHtml,
        siteUrl,
        buttonText: siteUrl ? 'Suivre ma commande →' : undefined,
        buttonUrl: siteUrl ? `${siteUrl}/boutique/compte/commandes` : undefined,
        logoText: bs.logoText || 'Boutique',
      })
      html = result.html
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
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''
    const logoText = bs.logoText || 'Boutique'
    const loginUrl = siteUrl ? `${siteUrl}/boutique/connexion` : ''

    const defaultText = `Bienvenue ${clientFirstName} !\n\nVotre compte a été créé avec succès.\n\nVous pouvez maintenant passer commande, suivre vos commandes et nous contacter via la messagerie.\n${siteUrl ? 'Accédez à votre compte : ' + siteUrl + '/boutique/compte' : ''}\n\nÀ bientôt !`
    const text = applyTemplate(template, defaultText, { firstName: clientFirstName })

    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Custom HTML template — substitute {firstName}, {email}, {loginUrl}.
      // The admin is responsible for the CTA button (preset already includes one).
      let processedTemplate = template
      const vars: Record<string, string> = {
        firstName: clientFirstName,
        email: clientEmail,
        loginUrl,
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl)
    } else {
      // Use standard HTML template (same wrapper as order emails)
      const bodyHtml = `
<p style="margin:0 0 12px 0;">Votre compte a été créé avec succès. Vous pouvez maintenant :</p>
<ul style="margin:8px 0;padding-left:20px;color:#495057;">
<li style="margin:4px 0;">🛍️ Passer commande sur notre boutique</li>
<li style="margin:4px 0;">📦 Suivre vos commandes en temps réel</li>
<li style="margin:4px 0;">💬 Nous contacter via la messagerie</li>
</ul>`

      const result = buildEmailTemplate({
        title: 'Bienvenue !',
        headerColor: '#007bff',
        firstName: clientFirstName,
        bodyHtml,
        siteUrl,
        buttonText: loginUrl ? 'Accéder à mon compte →' : undefined,
        buttonUrl: loginUrl || undefined,
        logoText,
      })
      html = result.html
    }

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

// ── Password reset request (forgot password) ───────────────────────────
// Uses the admin's custom `templatePasswordLost` if defined as HTML,
// otherwise falls back to the same buildEmailTemplate() wrapper used by
// notifyNewOrder / notifyOrderStatusChange so the visual style is consistent.
export async function notifyPasswordResetRequest(
  clientEmail: string,
  clientFirstName: string,
  resetUrl: string,
) {
  try {
    console.log('[email] notifyPasswordResetRequest triggered for:', clientEmail)
    const config = await getEmailConfig()
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''
    const logoText = bs.logoText || 'Boutique'

    const template = config?.templatePasswordLost || null
    const defaultText = `Bonjour ${clientFirstName},\n\nVous avez demandé à réinitialiser votre mot de passe.\n\nCliquez sur ce lien pour choisir un nouveau mot de passe :\n${resetUrl}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nÀ bientôt !`
    const text = applyTemplate(template, defaultText, {
      firstName: clientFirstName,
      resetUrl,
    })

    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Custom HTML template — replace variables {firstName}, {resetUrl}, {email}.
      // The admin is responsible for adding their own CTA button inside the
      // custom template (the modern preset already includes one). We do NOT
      // append a fallback button here — that was causing duplicate buttons
      // when the admin's template already had one.
      let processedTemplate = template
      const vars: Record<string, string> = {
        firstName: clientFirstName,
        resetUrl,
        email: clientEmail,
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl)
    } else {
      // Use standard HTML template (same wrapper as order emails)
      const bodyHtml = `
<p style="margin:0 0 12px 0;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Adresse email</p>
<p style="margin:0;font-weight:600;">${clientEmail}</p>
</div>
<p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;">⏰ Ce lien expirera dans 1 heure.</p>
<p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.</p>`

      const result = buildEmailTemplate({
        title: 'Réinitialisation de votre mot de passe',
        headerColor: '#007bff',
        firstName: clientFirstName,
        bodyHtml,
        siteUrl,
        buttonText: resetUrl ? 'Réinitialiser mon mot de passe →' : undefined,
        buttonUrl: resetUrl || undefined,
        logoText,
      })
      html = result.html
    }

    await sendEmail({
      to: clientEmail,
      subject: 'Réinitialisation de votre mot de passe',
      text,
      html,
    })
  } catch (e: any) {
    console.error('[email] notifyPasswordResetRequest error:', e?.message)
  }
}

// ── Password changed confirmation ──────────────────────────────────────
// Uses the admin's custom `templatePasswordChanged` if defined as HTML,
// otherwise falls back to the same buildEmailTemplate() wrapper used by
// notifyNewOrder / notifyOrderStatusChange so the visual style is consistent.
export async function notifyPasswordChanged(
  clientEmail: string,
  clientFirstName: string,
) {
  try {
    console.log('[email] notifyPasswordChanged triggered for:', clientEmail)
    const config = await getEmailConfig()
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''
    const logoText = bs.logoText || 'Boutique'
    const loginUrl = siteUrl ? `${siteUrl}/boutique/connexion` : ''

    const template = config?.templatePasswordChanged || null
    const defaultText = `Bonjour ${clientFirstName},\n\nVotre mot de passe a été modifié avec succès.\n\nVous pouvez maintenant vous connecter avec votre nouveau mot de passe.\n${loginUrl}\n\nSi vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.\n\nÀ bientôt !`
    const text = applyTemplate(template, defaultText, {
      firstName: clientFirstName,
    })

    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Custom HTML template — replace {firstName}, {email}.
      // The admin is responsible for adding their own CTA button inside the
      // custom template (the modern preset already includes one). We do NOT
      // append a fallback button here — that was causing duplicate buttons
      // when the admin's template already had one.
      let processedTemplate = template
      const vars: Record<string, string> = {
        firstName: clientFirstName,
        email: clientEmail,
        loginUrl,
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl)
    } else {
      // Use standard HTML template (same wrapper as order emails)
      const bodyHtml = `
<p style="margin:0 0 12px 0;">Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter à votre compte avec votre nouveau mot de passe.</p>
<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#047857;text-transform:uppercase;">Statut</p>
<p style="margin:0;font-weight:600;color:#047857;">✓ Mot de passe modifié</p>
</div>
<p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;">🔒 Si vous n'êtes pas à l'origine de ce changement, contactez-nous immédiatement.</p>`

      const result = buildEmailTemplate({
        title: 'Mot de passe modifié ✓',
        headerColor: '#10b981',
        firstName: clientFirstName,
        bodyHtml,
        siteUrl,
        buttonText: loginUrl ? 'Se connecter →' : undefined,
        buttonUrl: loginUrl || undefined,
        logoText,
      })
      html = result.html
    }

    await sendEmail({
      to: clientEmail,
      subject: 'Votre mot de passe a été modifié',
      text,
      html,
    })
  } catch (e: any) {
    console.error('[email] notifyPasswordChanged error:', e?.message)
  }
}

// ── Account validation (verify email on registration) ──────────────────
// Uses the admin's custom `templateValidate` if defined as HTML,
// otherwise falls back to the same buildEmailTemplate() wrapper used by
// the other notification emails so the visual style is consistent.
export async function notifyAccountValidation(
  clientEmail: string,
  clientFirstName: string,
  validationUrl: string,
) {
  try {
    console.log('[email] notifyAccountValidation triggered for:', clientEmail)
    const config = await getEmailConfig()
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''
    const logoText = bs.logoText || 'Boutique'

    const template = config?.templateValidate || null
    const defaultText = `Bonjour ${clientFirstName},\n\nMerci pour votre inscription !\n\nPour activer votre compte et finaliser votre inscription, veuillez valider votre adresse email en cliquant sur le lien ci-dessous :\n${validationUrl}\n\nCe lien est valable 24 heures.\n\nÀ bientôt !`
    const text = applyTemplate(template, defaultText, {
      firstName: clientFirstName,
      validationUrl,
    })

    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      // Custom HTML template — substitute {firstName}, {validationUrl}, {email}.
      let processedTemplate = template
      const vars: Record<string, string> = {
        firstName: clientFirstName,
        validationUrl,
        email: clientEmail,
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl)
    } else {
      // Use standard HTML template (same wrapper as order emails)
      const bodyHtml = `
<p style="margin:0 0 12px 0;">Merci pour votre inscription ! Pour activer votre compte et finaliser votre inscription, veuillez valider votre adresse email en cliquant sur le bouton ci-dessous :</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Adresse email</p>
<p style="margin:0;font-weight:600;">${clientEmail}</p>
</div>
<p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;">⏰ Ce lien est valable 24 heures.</p>
<p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;">Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.</p>`

      const result = buildEmailTemplate({
        title: 'Validez votre compte',
        headerColor: '#007bff',
        firstName: clientFirstName,
        bodyHtml,
        siteUrl,
        buttonText: validationUrl ? 'Valider mon compte →' : undefined,
        buttonUrl: validationUrl || undefined,
        logoText,
      })
      html = result.html
    }

    await sendEmail({
      to: clientEmail,
      subject: 'Validez votre compte',
      text,
      html,
    })
  } catch (e: any) {
    console.error('[email] notifyAccountValidation error:', e?.message)
  }
}

// ── Back-in-stock alert ────────────────────────────────────────────────
/**
 * Sends a "back in stock" email to one visitor who subscribed to a stock alert.
 * Uses the snapshot captured at subscription time (brand, title, photo) so the
 * email renders correctly even if the product info has changed meanwhile.
 *
 * Returns true if the email was sent successfully, false otherwise.
 */
export async function notifyBackInStock(opts: {
  email: string
  productSku: string
  productBrand: string
  productTitle?: string | null
  productPhoto?: string | null  // relative URL like "/api/uploads/..." or absolute
}): Promise<boolean> {
  try {
    console.log('[email] notifyBackInStock triggered for SKU:', opts.productSku, 'to:', opts.email)

    const config = await getEmailConfig()
    const bs = await getBoutiqueSettings()
    const siteUrl = bs.shareSiteUrl || ''
    const logoText = bs.logoText || 'Boutique'

    // Build absolute product URL (boutique product page)
    const productUrl = siteUrl
      ? `${siteUrl.replace(/\/+$/, '')}/boutique/produit/${encodeURIComponent(opts.productSku)}`
      : `/boutique/produit/${encodeURIComponent(opts.productSku)}`

    // Build absolute photo URL (only if a snapshot was captured)
    let photoUrl: string | null = null
    if (opts.productPhoto) {
      if (/^https?:\/\//i.test(opts.productPhoto)) {
        photoUrl = opts.productPhoto
      } else if (siteUrl) {
        photoUrl = `${siteUrl.replace(/\/+$/, '')}${opts.productPhoto}`
      } else {
        photoUrl = opts.productPhoto  // relative — may not render in some email clients, but better than nothing
      }
    }

    const title = opts.productTitle
      ? `${opts.productBrand} — ${opts.productTitle}`
      : opts.productBrand

    const subject = `Bon retour ! « ${title} » est de nouveau en stock`

    // Plain text fallback — same phrasing style as notifyNewOrder
    const text = `Bonjour,\n\nL'article que vous attendez est de nouveau disponible sur notre boutique !\n\n${title}\nSKU : ${opts.productSku}\n\nDécouvrez-le dès maintenant : ${productUrl}\n\nÀ bientôt !`

    // If the admin has defined a custom HTML template, use it (with variable substitution).
    // Otherwise, fall back to the default HTML body below.
    const template = config?.templateBackInStock || null

    let html: string
    if (template && /<[a-z][\s\S]*>/i.test(template)) {
      let processedTemplate = template
      const vars: Record<string, string> = {
        brand: escapeHtml(opts.productBrand),
        title: escapeHtml(opts.productTitle || ''),
        sku: escapeHtml(opts.productSku),
        productUrl,
        photoUrl: photoUrl || '',
      }
      for (const [key, value] of Object.entries(vars)) {
        processedTemplate = processedTemplate.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
      }
      html = migrateRelativeUrls(processedTemplate, siteUrl)
    } else {
      // Default HTML body — EXACT same structure as notifyNewOrder (confirmation de commande)
      // Uses the same <div> "info card" with #f9fafb bg, #e5e7eb border, uppercase labels, etc.
      const bodyHtml = `
<p style="margin:0 0 12px 0;">L'article que vous convoitez est de nouveau disponible sur notre boutique. Ne tardez pas — il pourrait repartir très vite !</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:12px 0;">
${photoUrl
  ? `<img src="${photoUrl}" alt="${escapeHtml(opts.productBrand)}" width="80" height="80" style="width:80px;height:80px;object-fit:cover;border-radius:6px;display:block;background:#e5e7eb;margin:0 0 12px 0;" />`
  : ''
}
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Marque</p>
<p style="margin:0 0 12px 0;font-weight:600;font-size:15px;">${escapeHtml(opts.productBrand)}</p>
${opts.productTitle ? `<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Article</p><p style="margin:0 0 12px 0;font-weight:600;font-size:15px;">${escapeHtml(opts.productTitle)}</p>` : ''}
<p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Référence</p>
<p style="margin:0;font-family:monospace;font-weight:600;font-size:15px;">${escapeHtml(opts.productSku)}</p>
</div>`

      // Same wrapper, same blue brand color as notifyNewOrder (confirmation de commande)
      const result = buildEmailTemplate({
        title: 'De retour en stock !',
        headerColor: '#007bff',
        firstName: '',  // visitor didn't give us their name — buildEmailTemplate renders "Bonjour,"
        bodyHtml,
        siteUrl,
        buttonText: "Voir l'article →",
        buttonUrl: productUrl,
        logoText,
      })
      html = result.html
    }

    const sent = await sendEmail({
      to: opts.email,
      subject,
      text,
      html,
    })

    return sent
  } catch (e: any) {
    console.error('[email] notifyBackInStock error:', e?.message)
    return false
  }
}

// Minimal HTML escaper — protects against user-controlled brand/title in the email HTML
function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
