'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, User, Package, Mail, LogOut, Edit, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface ClientInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  country: string
  newsletter: boolean
  createdAt: string
}

export default function ComptePage() {
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ClientInfo | null>(null)

  useEffect(() => {
    fetch('/api/boutique/client/me')
      .then(r => {
        if (!r.ok) {
          router.push('/boutique/connexion')
          return null
        }
        return r.json()
      })
      .then(data => {
        if (data) {
          setClient(data)
          setForm(data)
        }
        setLoading(false)
      })
      .catch(() => {
        router.push('/boutique/connexion')
        setLoading(false)
      })
  }, [router])

  const set = (k: keyof ClientInfo, v: any) => {
    setForm(prev => prev ? { ...prev, [k]: v } : null)
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/boutique/client/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        toast.error('Erreur lors de la sauvegarde')
        return
      }
      const updated = await res.json()
      setClient(updated)
      setForm(updated)
      setEditing(false)
      toast.success('Profil mis à jour')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    await fetch('/api/boutique/client/logout', { method: 'POST' })
    router.push('/boutique')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#007bff] mx-auto" />
      </div>
    )
  }

  if (!client || !form) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour {client.firstName} 👋</h1>
          <p className="text-sm text-gray-500">Gérez vos informations et consultez vos commandes</p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" /> Déconnexion
        </Button>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <Link href="/boutique/compte/commandes" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-[#007bff] transition-colors">
          <Package className="h-6 w-6 text-[#007bff] mb-2" />
          <p className="text-sm font-semibold text-gray-900">Mes commandes</p>
          <p className="text-xs text-gray-500">Suivre et consulter</p>
        </Link>
        <Link href="/boutique/compte/messages" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-[#007bff] transition-colors">
          <Mail className="h-6 w-6 text-[#007bff] mb-2" />
          <p className="text-sm font-semibold text-gray-900">Messagerie</p>
          <p className="text-xs text-gray-500">Contactez l'équipe</p>
        </Link>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <User className="h-6 w-6 text-[#007bff] mb-2" />
          <p className="text-sm font-semibold text-gray-900">Mes infos</p>
          <p className="text-xs text-gray-500">Coordonnées</p>
        </div>
      </div>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Mes informations</h2>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setForm(client); setEditing(false) }}>
                <X className="h-3.5 w-3.5 mr-1" /> Annuler
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Sauvegarder
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase">Prénom</Label>
            {editing ? (
              <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            ) : (
              <p className="font-medium">{client.firstName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase">Nom</Label>
            {editing ? (
              <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} />
            ) : (
              <p className="font-medium">{client.lastName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase">Email</Label>
            <p className="font-medium">{client.email}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase">Téléphone</Label>
            {editing ? (
              <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
            ) : (
              <p className="font-medium">{client.phone || '—'}</p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-gray-500 uppercase">Adresse</Label>
            {editing ? (
              <Input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="123 rue de la Paix" />
            ) : (
              <p className="font-medium">{client.address || '—'}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase">Code postal</Label>
            {editing ? (
              <Input value={form.postalCode || ''} onChange={e => set('postalCode', e.target.value)} />
            ) : (
              <p className="font-medium">{client.postalCode || '—'}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase">Ville</Label>
            {editing ? (
              <Input value={form.city || ''} onChange={e => set('city', e.target.value)} />
            ) : (
              <p className="font-medium">{client.city || '—'}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Membre depuis le {new Date(client.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  )
}
