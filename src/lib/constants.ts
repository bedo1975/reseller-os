// Constantes partagées — Reseller OS

export const PLATFORMS = [
  { id: 'vinted', label: 'Vinted', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'leboncoin', label: 'Leboncoin', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'ebay', label: 'eBay', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  { id: 'vestiaire', label: 'Vestiaire Collective', color: 'bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300' },
] as const

export const PUBLICATION_STATUSES = [
  { id: 'A_PHOTOGRAPHIER', label: 'À photographier', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  { id: 'A_REDIGER', label: 'À rédiger', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'PRET_A_PUBLIER', label: 'Prêt à publier', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'PUBLIE', label: 'Publié', color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'RESERVE', label: 'Réservé', color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { id: 'VENDU', label: 'Vendu', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
] as const

export const PARCEL_STATUSES = [
  { id: 'A_PREPARER', label: 'À préparer', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  { id: 'A_IMPRIMER', label: 'À imprimer', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'A_DEPOSER', label: 'À déposer', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'EN_TRANSIT', label: 'En transit', color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'LIVRE', label: 'Livré', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'PROBLEME', label: 'Problème', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
] as const

export const SUPPLIER_TYPES = [
  { id: 'friperie', label: 'Friperie' },
  { id: 'grossiste', label: 'Grossiste' },
  { id: 'destockeur', label: 'Déstockeur' },
  { id: 'vide-grenier', label: 'Vide-grenier' },
  { id: 'particulier', label: 'Particulier' },
  { id: 'fournisseur_divers', label: 'Fournisseur divers' },
] as const

export const CARRIERS = [
  { id: 'mondial_relay', label: 'Mondial Relay' },
  { id: 'chronopost', label: 'Chronopost' },
  { id: 'colissimo', label: 'Colissimo' },
  { id: 'dhl', label: 'DHL' },
] as const

export const CATEGORIES = [
  { id: 'vetements', label: 'Vêtements' },
  { id: 'chaussures', label: 'Chaussures' },
  { id: 'accessoires', label: 'Accessoires' },
  { id: 'luxe', label: 'Luxe' },
  { id: 'maison', label: 'Maison' },
] as const

export const CONDITIONS = [
  { id: 'neuf', label: 'Neuf avec étiquette' },
  { id: 'tres-bon', label: 'Très bon état' },
  { id: 'bon', label: 'Bon état' },
  { id: 'correct', label: 'État correct' },
] as const

export const EXPENSE_CATEGORIES = [
  { id: 'frais_port', label: 'Frais de port' },
  { id: 'frais_plateforme', label: 'Frais de plateforme' },
  { id: 'abonnement', label: 'Abonnement' },
  { id: 'fourniture', label: 'Fourniture' },
  { id: 'carburant', label: 'Carburant' },
  { id: 'autre', label: 'Autre' },
] as const

export const getPlatformLabel = (id: string | null | undefined) =>
  PLATFORMS.find(p => p.id === id)?.label || id || '—'

export const getPlatformColor = (id: string | null | undefined) =>
  PLATFORMS.find(p => p.id === id)?.color || 'bg-muted text-muted-foreground'

export const getPubStatusLabel = (id: string) =>
  PUBLICATION_STATUSES.find(s => s.id === id)?.label || id

export const getPubStatusColor = (id: string) =>
  PUBLICATION_STATUSES.find(s => s.id === id)?.color || 'bg-muted text-muted-foreground'

export const getParcelStatusLabel = (id: string) =>
  PARCEL_STATUSES.find(s => s.id === id)?.label || id

export const getParcelStatusColor = (id: string) =>
  PARCEL_STATUSES.find(s => s.id === id)?.color || 'bg-muted text-muted-foreground'

export const getSupplierTypeLabel = (id: string) =>
  SUPPLIER_TYPES.find(s => s.id === id)?.label || id

export const getCategoryLabel = (id: string) =>
  CATEGORIES.find(c => c.id === id)?.label || id

export const getConditionLabel = (id: string) =>
  CONDITIONS.find(c => c.id === id)?.label || id

export const getCarrierLabel = (id: string | null | undefined) =>
  CARRIERS.find(c => c.id === id)?.label || id || '—'

export const formatEUR = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0)

export const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const formatDateTime = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
