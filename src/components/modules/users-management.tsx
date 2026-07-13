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
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Edit, Users, Shield, Crown, Mail, Key, Loader2, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/constants'

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
