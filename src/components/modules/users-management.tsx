'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Mail, Crown, UserCircle, Plus, Edit, Trash2, Shield, Loader2, Users, Key,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/constants'

// Actions with labels + colors for the permission UI
const ALL_ACTIONS = [
  { key: 'view', label: 'Voir', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800' },
  { key: 'create', label: 'Créer', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-950/30', border: 'border-green-300 dark:border-green-800' },
  { key: 'edit', label: 'Éditer', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800' },
  { key: 'delete', label: 'Supprimer', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800' },
  { key: 'export', label: 'Exporter', color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950/30', border: 'border-violet-300 dark:border-violet-800' },
  { key: 'scan', label: 'Scanner', color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-950/30', border: 'border-cyan-300 dark:border-cyan-800' },
  { key: 'purchase', label: 'Achats HS', color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-950/30', border: 'border-pink-300 dark:border-pink-800' },
]

// Actions available per module
const MODULE_ACTIONS_MAP: Record<string, string[]> = {
  dashboard: ['view'],
  stock: ['view', 'create', 'edit', 'delete', 'export', 'scan', 'purchase'],
  sourcing: ['view', 'create', 'edit', 'delete'],
  publication: ['view', 'edit', 'create'],
  sales: ['view', 'create', 'edit', 'delete', 'export'],
  parcels: ['view', 'edit'],
  preorders: ['view', 'create', 'edit', 'delete'],
  profitability: ['view', 'export'],
  taxes: ['view', 'export'],
  bi: ['view', 'export'],
  vinted: ['view', 'create'],
  'product-trend': ['view', 'create'],
  photos: ['view', 'create', 'edit', 'delete'],
  'boutique-admin': ['view', 'create', 'edit', 'delete', 'export'],
  'boutique-admin:orders': ['view', 'edit', 'delete'],
  'boutique-admin:clients': ['view', 'edit', 'delete'],
  'boutique-admin:messages': ['view', 'edit'],
  'boutique-admin:appearance': ['view', 'edit'],
  'boutique-admin:shipping': ['view', 'edit', 'delete'],
  'boutique-admin:payments': ['view', 'edit', 'delete'],
  'boutique-admin:categories': ['view', 'edit', 'delete'],
  'boutique-admin:coupons': ['view', 'create', 'edit', 'delete'],
  'boutique-admin:share': ['view', 'edit'],
  'boutique-admin:newsletter': ['view', 'create', 'edit', 'delete'],
  statistics: ['view', 'export'],
  'staff-messaging': ['view', 'create', 'delete'],
  settings: ['view', 'edit'],
}

// Grouped module config for the permissions dialog — sections with color-coded headers
const PERM_SECTIONS: {
  title: string
  icon: string
  color: string
  modules: { key: string; label: string; icon: string; subItems?: { key: string; label: string; icon: string }[] }[]
}[] = [
  {
    title: 'Modules principaux',
    icon: '📁',
    color: 'border-l-blue-500',
    modules: [
      { key: 'dashboard', label: 'Tableau de bord', icon: '📊' },
      { key: 'stock', label: 'Stock', icon: '📦' },
      { key: 'sourcing', label: 'Sourcing', icon: '🚚' },
      { key: 'publication', label: 'Publication', icon: '📝' },
      { key: 'sales', label: 'Ventes', icon: '🛒' },
      { key: 'parcels', label: 'Colis', icon: '📬' },
      { key: 'preorders', label: 'Pré-commandes', icon: '📋' },
    ],
  },
  {
    title: 'Finance & Analytics',
    icon: '💰',
    color: 'border-l-emerald-500',
    modules: [
      { key: 'profitability', label: 'Rentabilité', icon: '📈' },
      { key: 'taxes', label: 'Fiscalité', icon: '🧾' },
      { key: 'bi', label: 'Intelligence métier', icon: '📊' },
      { key: 'statistics', label: 'Statistiques', icon: '📊' },
    ],
  },
  {
    title: 'Outils externes',
    icon: '🔍',
    color: 'border-l-violet-500',
    modules: [
      { key: 'vinted', label: 'Vinted Deals', icon: '🔍' },
      { key: 'product-trend', label: 'Product Trend', icon: '✨' },
      { key: 'photos', label: 'Shooting Photo', icon: '📸' },
    ],
  },
  {
    title: 'Boutique Admin',
    icon: '🛍️',
    color: 'border-l-pink-500',
    modules: [
      {
        key: 'boutique-admin', label: 'Boutique Admin', icon: '🛍️',
        subItems: [
          { key: 'boutique-admin:orders', label: 'Commandes', icon: '📦' },
          { key: 'boutique-admin:clients', label: 'Clients', icon: '👥' },
          { key: 'boutique-admin:messages', label: 'Messagerie', icon: '✉️' },
          { key: 'boutique-admin:appearance', label: 'Apparence', icon: '🎨' },
          { key: 'boutique-admin:shipping', label: 'Livraison', icon: '🚚' },
          { key: 'boutique-admin:payments', label: 'Paiements', icon: '💳' },
          { key: 'boutique-admin:categories', label: 'Catégories', icon: '🗂️' },
          { key: 'boutique-admin:coupons', label: 'Coupons', icon: '🎟️' },
          { key: 'boutique-admin:share', label: 'Partage', icon: '🎁' },
          { key: 'boutique-admin:newsletter', label: 'Newsletter', icon: '📧' },
        ],
      },
    ],
  },
  {
    title: 'Système',
    icon: '⚙️',
    color: 'border-l-stone-500',
    modules: [
      { key: 'staff-messaging', label: 'Messagerie interne', icon: '✉️' },
      { key: 'settings', label: 'Paramètres', icon: '⚙️' },
    ],
  },
]

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  _count?: { stockItems: number; sales: number; suppliers: number; expenses: number }
}

export function UsersManagement() {
  const { data: session } = useSession()
  const currentUserId = session?.user?.id
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [permUser, setPermUser] = useState<UserRow | null>(null)
  const [permData, setPermData] = useState<Record<string, string[]>>({})
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setUsers(data)
    } catch (e) {
      console.error('fetch users error:', e)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success('Utilisateur supprimé')
      setDeleteTarget(null)
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const openPermissions = async (u: UserRow) => {
    setPermUser(u)
    setPermLoading(true)
    try {
      const res = await fetch(`/api/users/${u.id}/permissions`)
      const data = await res.json()
      if (res.ok) {
        setPermData(data.permissions || {})
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setPermLoading(false)
    }
  }

  const savePermissions = async () => {
    if (!permUser) return
    setPermSaving(true)
    try {
      const res = await fetch(`/api/users/${permUser.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permData }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Permissions mises à jour')
      setPermUser(null)
    } catch {
      toast.error('Erreur')
    } finally {
      setPermSaving(false)
    }
  }

  const togglePerm = (module: string, action: string) => {
    setPermData(prev => {
      const current = prev[module] || []
      const next = current.includes(action)
        ? current.filter(a => a !== action)
        : [...current, action]
      return { ...prev, [module]: next }
    })
  }

  const toggleAllPerm = (module: string, checked: boolean) => {
    setPermData(prev => ({
      ...prev,
      [module]: checked
        ? (MODULE_ACTIONS_MAP[module] || ['view'])
        : [],
    }))
  }

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-card dark:to-emerald-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Administration</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Gestion des utilisateurs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Créez des comptes Staff pour gérer le stock, les ventes, les colis et la publication. Les administrateurs ont accès à tout, y compris la <strong>fiscalité</strong> et la <strong>rentabilité</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Comptes
              </CardTitle>
              <CardDescription className="mt-1">
                {users ? `${users.length} utilisateur(s)` : 'Chargement...'}
              </CardDescription>
            </div>
            <Button onClick={() => { setEditing(null); setShowForm(true) }} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Nouvel utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Aucun utilisateur</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-center">Activité</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => {
                  const isMe = u.id === currentUserId
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                            u.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          }`}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-1.5">
                              {u.name}
                              {isMe && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1">Vous</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">
                            <Crown className="h-3 w-3 mr-1" /> Admin
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100">
                            <UserCircle className="h-3 w-3 mr-1" /> Staff
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-xs text-muted-foreground">
                          {(u._count?.stockItems ?? 0) + (u._count?.sales ?? 0)} activités
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setEditing(u); setShowForm(true) }}
                            title="Modifier"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openPermissions(u)}
                            disabled={u.role === 'admin'}
                            title={u.role === 'admin' ? 'Les admins ont toutes les permissions' : 'Permissions'}
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                            onClick={() => setDeleteTarget(u)}
                            disabled={isMe}
                            title={isMe ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserForm
        open={showForm}
        onOpenChange={setShowForm}
        user={editing}
        onSaved={() => { setShowForm(false); refresh() }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}).
              Ses données seront conservées mais détachées de son compte (userId = null).
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permUser} onOpenChange={(o) => !o && setPermUser(null)}>
        <DialogContent className="sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions — {permUser?.name}
            </DialogTitle>
            <DialogDescription>
              Activez ou désactivez les actions pour chaque module. Désactivez « Voir » pour masquer complètement un module du menu.
            </DialogDescription>
          </DialogHeader>

          {permLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Action legend */}
              <div className="flex flex-wrap gap-2 pb-3 border-b">
                {ALL_ACTIONS.map(a => (
                  <span key={a.key} className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', a.bg, a.color, a.border)}>
                    {a.label}
                  </span>
                ))}
              </div>

              {/* Grouped sections */}
              {PERM_SECTIONS.map(section => (
                <div key={section.title} className={cn('border-l-4 pl-3', section.color)}>
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span>{section.icon}</span> {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.modules.map(mod => {
                      const modActions = MODULE_ACTIONS_MAP[mod.key] || ['view']
                      return (
                        <div key={mod.key}>
                          {/* Module row */}
                          <PermRow
                            modKey={mod.key}
                            modLabel={mod.label}
                            modIcon={mod.icon}
                            modActions={modActions}
                            permData={permData}
                            togglePerm={togglePerm}
                            toggleAllPerm={toggleAllPerm}
                          />
                          {/* Sub-items (for boutique-admin) */}
                          {mod.subItems?.map(sub => {
                            const subActions = MODULE_ACTIONS_MAP[sub.key] || ['view']
                            return (
                              <div key={sub.key} className="ml-4">
                                <PermRow
                                  modKey={sub.key}
                                  modLabel={sub.label}
                                  modIcon={sub.icon}
                                  modActions={subActions}
                                  permData={permData}
                                  togglePerm={togglePerm}
                                  toggleAllPerm={toggleAllPerm}
                                  isSubItem
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Quick actions */}
              <div className="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => {
                  const all: Record<string, string[]> = {}
                  for (const sec of PERM_SECTIONS) {
                    for (const m of sec.modules) {
                      all[m.key] = MODULE_ACTIONS_MAP[m.key] || ['view']
                      m.subItems?.forEach(s => { all[s.key] = MODULE_ACTIONS_MAP[s.key] || ['view'] })
                    }
                  }
                  setPermData(all)
                }}>
                  Tout autoriser
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPermData({})}>
                  Tout révoquer
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPermUser(null)}>Annuler</Button>
            <Button onClick={savePermissions} disabled={permSaving}>
              {permSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserForm({ open, onOpenChange, user, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: UserRow | null
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        role: (user?.role as 'admin' | 'staff') || 'staff',
      })
    }
  }, [open, user])

  const submit = async () => {
    if (!form.name) {
      toast.error('Nom requis')
      return
    }
    if (!user && !form.email) {
      toast.error('Email requis')
      return
    }
    if (!user && form.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (user && form.password && form.password.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }

    setSaving(true)
    try {
      if (user) {
        // Edit mode
        const body: Record<string, unknown> = {
          name: form.name,
          role: form.role,
        }
        if (form.password) body.password = form.password
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur')
        toast.success('Utilisateur modifié')
      } else {
        // Create mode
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur')
        toast.success('Utilisateur créé')
      }
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </DialogTitle>
          <DialogDescription>
            {user
              ? `Modifiez le nom, le rôle ou réinitialisez le mot de passe de ${user.email}.`
              : 'Créez un nouveau compte Staff ou Admin.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom complet *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Jean Dupont"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Email {!user && '*'}
            </Label>
            <Input
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="vous@exemple.fr"
              disabled={!!user}
              className={user ? 'bg-muted text-muted-foreground' : ''}
            />
            {user && (
              <p className="text-[11px] text-muted-foreground">L'email ne peut pas être modifié.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Key className="h-3 w-3" /> {user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={user ? 'Laisser vide pour ne pas changer' : 'Au moins 8 caractères'}
            />
            {user && (
              <p className="text-[11px] text-muted-foreground">
                Remplissez ce champ pour réinitialiser le mot de passe.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rôle</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm({ ...form, role: v as 'admin' | 'staff' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5 text-emerald-600" />
                    <div>
                      <div className="font-medium">Admin</div>
                      <div className="text-[10px] text-muted-foreground">Accès complet (fiscalité, rentabilité, utilisateurs)</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="staff">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-3.5 w-3.5 text-sky-600" />
                    <div>
                      <div className="font-medium">Staff</div>
                      <div className="text-[10px] text-muted-foreground">Stock, ventes, colis, publication, sourcing</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
            ) : (
              user ? 'Modifier' : 'Créer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Permission row component (used in the permissions dialog) ──────────────
// Renders a single module row with color-coded action toggle chips.

function PermRow({
  modKey,
  modLabel,
  modIcon,
  modActions,
  permData,
  togglePerm,
  toggleAllPerm,
  isSubItem,
}: {
  modKey: string
  modLabel: string
  modIcon: string
  modActions: string[]
  permData: Record<string, string[]>
  togglePerm: (module: string, action: string) => void
  toggleAllPerm: (module: string, checked: boolean) => void
  isSubItem?: boolean
}) {
  const actions = permData[modKey] || []
  const allChecked = modActions.length > 0 && modActions.every(a => actions.includes(a))

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30 transition-colors',
      isSubItem && 'opacity-90',
    )}>
      {/* Module name */}
      <div className="flex items-center gap-1.5 min-w-[140px] shrink-0">
        <span className="text-sm">{modIcon}</span>
        <span className={cn('text-sm font-medium', isSubItem && 'text-muted-foreground')}>{modLabel}</span>
      </div>

      {/* Action chips */}
      <div className="flex flex-wrap gap-1 flex-1">
        {ALL_ACTIONS.map(a => {
          if (!modActions.includes(a.key)) return null
          const checked = actions.includes(a.key)
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => togglePerm(modKey, a.key)}
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all',
                checked
                  ? cn(a.bg, a.color, a.border)
                  : 'bg-transparent text-muted-foreground/40 border-muted-foreground/20 hover:border-muted-foreground/40',
              )}
            >
              {a.label}
            </button>
          )
        })}
      </div>

      {/* All toggle */}
      <button
        type="button"
        onClick={() => toggleAllPerm(modKey, !allChecked)}
        className={cn(
          'text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 transition-all',
          allChecked
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-400'
            : 'bg-transparent text-muted-foreground/40 border-muted-foreground/20 hover:border-muted-foreground/40',
        )}
        title="Activer/désactiver toutes les actions"
      >
        Tout
      </button>
    </div>
  )
}
