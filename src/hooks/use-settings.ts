'use client'

import { useEffect, useState } from 'react'

// Types d'attributs personnalisables via Settings
export type AttributeType = 'category' | 'subcategory' | 'condition' | 'size' | 'color' | 'carrier' | 'platform' | 'lot_origin'

export interface Attribute {
  id: string
  type: AttributeType
  value: string
  code: string
  trackingUrl?: string | null
  parentCode?: string | null  // pour sous-catégories: code de la catégorie parente
  sortOrder: number
  isDefault: boolean
}

// Valeurs par défaut (fallback si l'API ne répond pas)
const DEFAULTS: Record<AttributeType, { value: string; code: string; trackingUrl?: string; parentCode?: string }[]> = {
  category: [
    { value: 'Vêtements', code: 'vetements' },
    { value: 'Chaussures', code: 'chaussures' },
    { value: 'Accessoires', code: 'accessoires' },
    { value: 'Luxe', code: 'luxe' },
    { value: 'Maison', code: 'maison' },
  ],
  subcategory: [],
  condition: [
    { value: 'Neuf avec étiquette', code: 'neuf' },
    { value: 'Très bon état', code: 'tres-bon' },
    { value: 'Bon état', code: 'bon' },
    { value: 'État correct', code: 'correct' },
  ],
  size: [
    { value: 'XS', code: 'XS' },
    { value: 'S', code: 'S' },
    { value: 'M', code: 'M' },
    { value: 'L', code: 'L' },
    { value: 'XL', code: 'XL' },
    { value: 'XXL', code: 'XXL' },
    { value: 'TU', code: 'TU' },
    { value: '32', code: '32' },
    { value: '34', code: '34' },
    { value: '36', code: '36' },
    { value: '38', code: '38' },
    { value: '40', code: '40' },
    { value: '42', code: '42' },
    { value: '43', code: '43' },
    { value: '44', code: '44' },
  ],
  color: [
    { value: 'Noir', code: 'Noir' },
    { value: 'Blanc', code: 'Blanc' },
    { value: 'Gris', code: 'Gris' },
    { value: 'Bleu marine', code: 'Bleu marine' },
    { value: 'Bleu', code: 'Bleu' },
    { value: 'Rouge', code: 'Rouge' },
    { value: 'Vert', code: 'Vert' },
    { value: 'Beige', code: 'Beige' },
    { value: 'Marron', code: 'Marron' },
    { value: 'Camel', code: 'Camel' },
  ],
  carrier: [
    { value: 'Mondial Relay', code: 'mondial_relay', trackingUrl: 'https://www.mondialrelay.fr/suivi-de-colis?NumeroExpedition={tracking}' },
    { value: 'Chronopost', code: 'chronopost', trackingUrl: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={tracking}' },
    { value: 'Colissimo', code: 'colissimo', trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}' },
    { value: 'DHL', code: 'dhl', trackingUrl: 'https://www.dhl.com/fr/fr/home/tracking/tracking-parcel.html?submit=1&tracking-id={tracking}' },
    { value: 'UPS', code: 'ups', trackingUrl: 'https://www.ups.com/track?tracknum={tracking}' },
    { value: 'DPD', code: 'dpd', trackingUrl: 'https://www.dpd.com/fr/fr/suivre_mon_colonnis/{tracking}' },
    { value: 'Relais Colis', code: 'relais_colis', trackingUrl: 'https://www.relaiscolis.fr/suivi?numExpe={tracking}' },
  ],
  platform: [
    { value: 'Vinted', code: 'vinted' },
    { value: 'Leboncoin', code: 'leboncoin' },
    { value: 'eBay', code: 'ebay' },
    { value: 'Vestiaire Collective', code: 'vestiaire' },
    { value: 'Boutique', code: 'boutique' },
  ],
  lot_origin: [
    { value: 'Lot 1', code: 'lot-1' },
    { value: 'Lot 2', code: 'lot-2' },
    { value: 'Lot 3', code: 'lot-3' },
  ],
}

// Cache global partagé entre toutes les instances du hook
let cache: Attribute[] | null = null
let fetchPromise: Promise<Attribute[]> | null = null
const subscribers = new Set<(attrs: Attribute[]) => void>()

async function fetchAttributes(): Promise<Attribute[]> {
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      // Si vide, on initialise avec les valeurs par défaut (côté client seulement)
      return []
    }
    return data
  } catch (e) {
    console.error('useSettings fetch error:', e)
    return []
  }
}

function toAttrs(type: AttributeType, list: { value: string; code: string; trackingUrl?: string; parentCode?: string }[]): Attribute[] {
  return list.map((x, i) => ({
    id: `default-${type}-${i}`,
    type,
    value: x.value,
    code: x.code,
    trackingUrl: x.trackingUrl || null,
    parentCode: x.parentCode || null,
    sortOrder: i,
    isDefault: i === 0,
  }))
}

export function useSettings() {
  // Initialise avec le cache s'il existe (évite un setState synchrone dans l'effet)
  const [attributes, setAttributes] = useState<Attribute[]>(
    () => cache || [
      ...toAttrs('category', DEFAULTS.category),
      ...toAttrs('condition', DEFAULTS.condition),
      ...toAttrs('size', DEFAULTS.size),
      ...toAttrs('color', DEFAULTS.color),
      ...toAttrs('carrier', DEFAULTS.carrier),
    ]
  )
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let mounted = true

    // Si pas de cache, on déclenche le fetch
    if (!cache && !fetchPromise) {
      fetchPromise = fetchAttributes().then(attrs => {
        const effective = attrs.length > 0
          ? attrs
          : [
              ...toAttrs('category', DEFAULTS.category),
              ...toAttrs('condition', DEFAULTS.condition),
              ...toAttrs('size', DEFAULTS.size),
              ...toAttrs('color', DEFAULTS.color),
              ...toAttrs('carrier', DEFAULTS.carrier),
            ]
        cache = effective
        subscribers.forEach(fn => fn(effective))
        return effective
      })
    }

    // S'abonner aux futures mises à jour
    if (fetchPromise) {
      fetchPromise.then(attrs => {
        if (mounted) {
          setAttributes(attrs)
          setLoading(false)
        }
      })
    }

    // Subscribe pour recharger quand les attributs changent
    const sub = (attrs: Attribute[]) => {
      if (mounted) setAttributes(attrs)
    }
    subscribers.add(sub)

    return () => {
      mounted = false
      subscribers.delete(sub)
    }
  }, [])

  const refresh = async () => {
    cache = null
    fetchPromise = null
    const attrs = await fetchAttributes()
    const effective = attrs.length > 0
      ? attrs
      : [
          ...toAttrs('category', DEFAULTS.category),
          ...toAttrs('condition', DEFAULTS.condition),
          ...toAttrs('size', DEFAULTS.size),
          ...toAttrs('color', DEFAULTS.color),
          ...toAttrs('carrier', DEFAULTS.carrier),
        ]
    cache = effective
    fetchPromise = Promise.resolve(effective)
    subscribers.forEach(fn => fn(effective))
    setAttributes(effective)
  }

  const getByType = (type: AttributeType): Attribute[] => {
    const list = attributes.filter(a => a.type === type)
    if (list.length > 0) return list
    // Fallback sur les valeurs par défaut si le type n'a pas encore d'attribut
    return toAttrs(type, DEFAULTS[type])
  }

  // Récupère les sous-catégories d'une catégorie parente
  const getSubcategories = (parentCode: string | null | undefined): Attribute[] => {
    if (!parentCode) return []
    return attributes.filter(a => a.type === 'subcategory' && a.parentCode === parentCode)
  }

  const getLabel = (type: AttributeType, code: string | null | undefined): string => {
    if (!code) return '—'
    const list = getByType(type)
    return list.find(a => a.code === code)?.value || code
  }

  // Construit l'URL de suivi pour un transporteur + un n° de suivi donné
  // Retourne null si le transporteur n'a pas d'URL configurée
  const getTrackingUrl = (carrierCode: string | null | undefined, trackingNumber: string | null | undefined): string | null => {
    if (!carrierCode || !trackingNumber) return null
    const carrier = getByType('carrier').find(c => c.code === carrierCode)
    if (!carrier?.trackingUrl) return null
    return carrier.trackingUrl.replace('{tracking}', encodeURIComponent(trackingNumber))
  }

  return { attributes, loading, refresh, getByType, getSubcategories, getLabel, getTrackingUrl }
}

// Helper exporté pour usage non-React (avec fallback)
export const getDefaults = () => DEFAULTS
