'use client'

import { create } from 'zustand'

export type ModuleKey =
  | 'dashboard'
  | 'stock'
  | 'sourcing'
  | 'publication'
  | 'sales'
  | 'parcels'
  | 'profitability'
  | 'taxes'
  | 'bi'
  | 'vinted'
  | 'product-trend'
  | 'photos'
  | 'boutique-admin'
  | 'settings'

interface AppState {
  activeModule: ModuleKey
  setModule: (m: ModuleKey) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'dashboard',
  setModule: (m) => set({ activeModule: m, mobileNavOpen: false }),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}))
