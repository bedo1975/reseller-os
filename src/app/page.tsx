'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Boxes, Truck, FileText, ShoppingCart, Package,
  TrendingUp, Receipt, BarChart3, Menu, Store, Sparkles, RotateCw, Settings,
  LogOut, Crown, UserCircle, Loader2, ShieldAlert, QrCode, Search, Camera, ShoppingBag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { DashboardModule } from '@/components/modules/dashboard-module'
import { StockModule } from '@/components/modules/stock-module'
import { SourcingModule } from '@/components/modules/sourcing-module'
import { PublicationModule } from '@/components/modules/publication-module'
import { SalesModule } from '@/components/modules/sales-module'
import { ParcelsModule } from '@/components/modules/parcels-module'
import { ProfitabilityModule } from '@/components/modules/profitability-module'
import { TaxesModule } from '@/components/modules/taxes-module'
import { BiModule } from '@/components/modules/bi-module'
import { VintedModule } from '@/components/modules/vinted-module'
import { PhotoSessionModule } from '@/components/modules/photo-session-module'
import { BoutiqueAdminModule } from '@/components/modules/boutique-admin-module'
import { SettingsModule } from '@/components/modules/settings-module'
import { ReminderPopup } from '@/components/shared/reminder-popup'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NavItem {
  key: ModuleKey
  label: string
  short: string
  icon: React.ElementType
  description: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', short: 'Dashboard', icon: LayoutDashboard, description: "Vue d'ensemble de l'activité" },
  { key: 'stock', label: 'Stock', short: 'Stock', icon: Boxes, description: 'Articles & emplacements' },
  { key: 'sourcing', label: 'Sourcing', short: 'Sourcing', icon: Truck, description: 'Fournisseurs & ROI' },
  { key: 'publication', label: 'Publication', short: 'Publication', icon: FileText, description: 'Workflow de mise en ligne' },
  { key: 'sales', label: 'Ventes', short: 'Ventes', icon: ShoppingCart, description: 'Historique complet' },
  { key: 'parcels', label: 'Colis', short: 'Colis', icon: Package, description: 'Vue Kanban expéditions' },
  { key: 'profitability', label: 'Rentabilité', short: 'Rentabilité', icon: TrendingUp, description: 'Dashboard financier', adminOnly: true },
  { key: 'taxes', label: 'Fiscalité', short: 'Fiscalité', icon: Receipt, description: 'Suivi & exports', adminOnly: true },
  { key: 'bi', label: 'Intelligence métier', short: 'BI', icon: BarChart3, description: 'Analyses & tendances' },
  { key: 'vinted', label: 'Vinted Deals', short: 'Vinted', icon: Search, description: 'Recherche & deals Vinted' },
  { key: 'photos', label: 'Shooting Photo', short: 'Photos', icon: Camera, description: 'Sessions photos produits' },
  { key: 'boutique-admin', label: 'Boutique Admin', short: 'Boutique', icon: ShoppingBag, description: 'Gestion boutique en ligne', adminOnly: true },
  { key: 'settings', label: 'Paramètres', short: 'Paramètres', icon: Settings, description: 'Catégories, états, tailles, couleurs' },
]

function getInitials(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function SidebarContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { activeModule, setModule } = useAppStore()
  const [reseedConfirm, setReseedConfirm] = useState(false)
  const [reseeding, setReseeding] = useState(false)

  const isAdmin = session?.user?.role === 'admin'

  // Filter out admin-only items for staff users
  const visibleNavItems = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin)

  const handleReseed = async () => {
    setReseeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Base réinitialisée avec des données démo')
        setTimeout(() => window.location.reload(), 800)
      } else {
        toast.error(data.error || 'Erreur lors de la réinitialisation')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setReseeding(false)
      setReseedConfirm(false)
    }
  }

  const handleLogout = () => {
    signOut({ redirect: false }).then(() => {
      router.push('/login')
    })
  }

  // If session is loading, show a minimal placeholder
  if (status === 'loading') {
    return (
      <div className="flex flex-col h-full">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Reseller OS</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Multi-plateformes</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Should never happen (middleware protects this page) but just in case
  if (!session?.user) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Reseller OS</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Multi-plateformes</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Session expirée</p>
          <Button size="sm" onClick={() => router.push('/login')}>
            Reconnexion
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Reseller OS</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Multi-plateformes</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visibleNavItems.filter(n => n.key !== 'settings').map(item => {
          const Icon = item.icon
          const active = activeModule === item.key
          return (
            <button
              key={item.key}
              onClick={() => setModule(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                'hover:bg-accent hover:text-accent-foreground',
                active && 'bg-accent text-accent-foreground shadow-sm'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active && 'text-emerald-600')} />
              <div className="flex-1 text-left min-w-0">
                <div className="truncate flex items-center gap-1.5">
                  {item.label}
                  {item.adminOnly && (
                    <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                </div>
              </div>
              {active && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            </button>
          )
        })}

        <div className="pt-3 mt-3 border-t">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Système</p>
          {visibleNavItems.filter(n => n.key === 'settings').map(item => {
            const Icon = item.icon
            const active = activeModule === item.key
            return (
              <button
                key={item.key}
                onClick={() => setModule(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-accent hover:text-accent-foreground',
                  active && 'bg-accent text-accent-foreground shadow-sm'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-emerald-600')} />
                <div className="flex-1 text-left min-w-0">
                  <div className="truncate">{item.label}</div>
                </div>
                {active && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* User card + Footer */}
      <div className="p-3 border-t space-y-2">
        {/* Scan QR button (mobile) */}
        <a href="/scan" className="block">
          <Button variant="default" size="sm" className="w-full justify-center text-xs bg-emerald-600 hover:bg-emerald-700">
            <QrCode className="h-4 w-4 mr-2" /> Scanner un article
          </Button>
        </a>

        {/* User card */}
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 border border-border/60">
          <div className={cn(
            'h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold',
            isAdmin
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
          )}>
            {getInitials(session.user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">
              {session.user.name || session.user.email}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {isAdmin ? (
                <Badge className="text-[9px] h-4 px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">
                  <Crown className="h-2.5 w-2.5 mr-0.5" /> Admin
                </Badge>
              ) : (
                <Badge className="text-[9px] h-4 px-1 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100">
                  <UserCircle className="h-2.5 w-2.5 mr-0.5" /> Staff
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground truncate">{session.user.email}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setReseedConfirm(true)}
              disabled={reseeding}
            >
              {reseeding ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5 mr-2" />
              )}
              Re-seed
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => window.open('/boutique', '_blank')}
          >
            <Store className="h-3.5 w-3.5 mr-2" />
            Voir la boutique
          </Button>
        </div>
        <div className="pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Déconnexion
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground px-1">
          v1.0 · Next.js 16 · Prisma · NextAuth
        </div>
      </div>

      <AlertDialog open={reseedConfirm} onOpenChange={setReseedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser toutes les données ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va <strong>supprimer</strong> tous les articles, ventes, fournisseurs, dépenses et attributs actuels,
              puis recréer un jeu de données démo. <strong>Cette action est irréversible.</strong>
              <br /><br />
              Vos comptes utilisateurs ne seront pas affectés. Les nouvelles données démo seront associées à votre compte admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reseeding}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReseed}
              disabled={reseeding}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {reseeding ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Réinitialisation...</>
              ) : (
                'Réinitialiser'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function Home() {
  const { activeModule, setModule, mobileNavOpen, setMobileNavOpen } = useAppStore()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  // Filter out admin-only items for staff users
  const visibleNavItems = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin)

  // Make sure the active module is allowed for the current user.
  // If staff somehow lands on an admin-only module, redirect to dashboard.
  const activeItem = visibleNavItems.find(n => n.key === activeModule) ?? visibleNavItems[0]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r bg-card/30 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Nav */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b bg-card/30 backdrop-blur-sm flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold leading-tight">{activeItem.label}</h2>
                {NAV_ITEMS.findIndex(n => n.key === activeModule) >= 0 && (
                  <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] h-5">
                    Module {NAV_ITEMS.findIndex(n => n.key === activeModule) + 1}
                  </Badge>
                )}
                {activeItem.adminOnly && (
                  <Badge className="hidden sm:inline-flex text-[10px] h-5 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100">
                    <Crown className="h-3 w-3 mr-1" /> Admin
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">{activeItem.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Démo active</span>
            </div>
          </div>
        </header>

        {/* Module content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
            {activeModule === 'dashboard' && <DashboardModule onNavigate={setModule} />}
            {activeModule === 'stock' && <StockModule />}
            {activeModule === 'sourcing' && <SourcingModule />}
            {activeModule === 'publication' && <PublicationModule />}
            {activeModule === 'sales' && <SalesModule />}
            {activeModule === 'parcels' && <ParcelsModule />}
            {activeModule === 'profitability' && isAdmin && <ProfitabilityModule />}
            {activeModule === 'taxes' && isAdmin && <TaxesModule />}
            {activeModule === 'bi' && <BiModule />}
            {activeModule === 'vinted' && <VintedModule />}
            {activeModule === 'photos' && <PhotoSessionModule />}
            {activeModule === 'boutique-admin' && isAdmin && <BoutiqueAdminModule />}
            {activeModule === 'settings' && <SettingsModule />}
          </div>
        </div>
      </main>

      {/* Popup de rappels automatiques */}
      <ReminderPopup />
    </div>
  )
}
