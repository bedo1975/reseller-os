import { db } from '@/lib/db'

interface InvoiceSettingsRow {
  id: string
  userId: string
  companyName: string
  address: string
  postalCode: string
  city: string
  country: string
  email: string | null
  phone: string | null
  siret: string | null
  rcs: string | null
  vatEnabled: boolean
  vatNumber: string | null
  vatRate: number
  invoicePrefix: string
  invoiceCounter: number
  invoicePadLength: number
  legalMentions: string | null
}

export async function getOrCreateInvoiceSettings(userId: string): Promise<InvoiceSettingsRow> {
  const existing = await db.invoiceSettings.findUnique({ where: { userId } })
  if (existing) return existing

  const user = await db.user.findUnique({ where: { id: userId } })
  return await db.invoiceSettings.create({
    data: {
      userId,
      companyName: user?.name || 'Ma Société',
      address: '',
      postalCode: '',
      city: '',
    },
  })
}

export async function generateInvoiceNumber(userId: string): Promise<{ number: string; settings: InvoiceSettingsRow }> {
  const settings = await getOrCreateInvoiceSettings(userId)

  const year = new Date().getFullYear()
  const prefix = settings.invoicePrefix.replace('{YEAR}', String(year))
  const nextCounter = settings.invoiceCounter + 1
  const paddedCounter = String(nextCounter).padStart(settings.invoicePadLength, '0')
  const invoiceNumber = `${prefix}${paddedCounter}`

  await db.invoiceSettings.update({
    where: { userId },
    data: { invoiceCounter: nextCounter },
  })

  settings.invoiceCounter = nextCounter
  return { number: invoiceNumber, settings }
}
