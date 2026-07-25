'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSettings, type AttributeType } from '@/hooks/use-settings'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { HtmlEditor } from '@/components/ui/html-editor'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Trash2, Star, Edit, Tag, Layers, Ruler, Palette, AlertCircle, Truck, ExternalLink, Users, Settings as SettingsIcon,
  FileText, Database, Download, Upload, HardDrive, ShieldAlert, RefreshCw, FileDown, Sparkles, Key, ExternalLink as LinkIcon, CheckCircle2, Percent, Bell, Clock, Calendar, Store, Package, Mail, BookOpen, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/constants'
import { useConfirm } from '@/components/shared/confirm-provider'
import { UsersManagement } from '@/components/modules/users-management'

interface Attribute {
  id: string
  type: AttributeType
  value: string
  code: string
  sortOrder: number
  isDefault: boolean
}

interface TabDef {
  type: AttributeType
  label: string
  singular: string
  icon: React.ElementType
  accent: string
  description: string
  codePlaceholder: string
  valuePlaceholder: string
}

const TABS: TabDef[] = [
  // NOTE: Catégories et Sous-catégories sont maintenant gérées dans Boutique Admin → Catégories
  // (modèle BoutiqueCategory unifié avec parentId pour les sous-catégories)
  {
    type: 'condition', label: 'États', singular: 'État', icon: Tag,
    accent: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    description: 'États possibles pour un article (neuf, très bon état, bon état...)',
    codePlaceholder: 'tres-bon', valuePlaceholder: 'Très bon état',
  },
  {
    type: 'size', label: 'Tailles', singular: 'Taille', icon: Ruler,
    accent: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30',
    description: 'Tailles disponibles (XS, S, M, L, XL, 38, 40, 42, TU...)',
    codePlaceholder: 'L', valuePlaceholder: 'L',
  },
  {
    type: 'color', label: 'Couleurs', singular: 'Couleur', icon: Palette,
    accent: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
    description: 'Couleurs disponibles (Noir, Bleu marine, Camel, Gris...)',
    codePlaceholder: 'Bleu marine', valuePlaceholder: 'Bleu marine',
  },
  {
    type: 'carrier', label: 'Transporteurs', singular: 'Transporteur', icon: Truck,
    accent: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
    description: 'Transporteurs avec URL de suivi (Mondial Relay, Chronopost, Colissimo, DHL...)',
    codePlaceholder: 'mondial_relay', valuePlaceholder: 'Mondial Relay',
  },
  {
    type: 'platform', label: 'Plateformes', singular: 'Plateforme', icon: Store,
    accent: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30',
    description: 'Plateformes de vente (Vinted, Leboncoin, eBay, Vestiaire, Boutique...)',
    codePlaceholder: 'vinted', valuePlaceholder: 'Vinted',
  },
  {
    type: 'lot_origin', label: 'Lots d\'origine', singular: 'Lot', icon: Package,
    accent: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
    description: 'Lots d\'origine pour tracer vos achats (Lot 1, Lot 2, Friperie Janvier...)',
    codePlaceholder: 'lot-1', valuePlaceholder: 'Lot 1',
  },
]

type SectionKey = 'attributes' | 'users' | 'invoicing' | 'maintenance' | 'ai' | 'tax' | 'reminders' | 'boutique' | 'email' | 'howto'

export function SettingsModule() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [section, setSection] = useState<SectionKey>('attributes')

  // If non-admin, force a non-admin section
  if (!isAdmin && (section === 'users' || section === 'maintenance')) {
    setSection('attributes')
  }

  const navBtn = (key: SectionKey, icon: React.ElementType, label: string, adminOnly = false) => {
    if (adminOnly && !isAdmin) return null
    const Icon = icon
    const active = section === key
    return (
      <button
        key={key}
        onClick={() => setSection(key)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
          active
            ? 'border-foreground/30 bg-card shadow-sm text-foreground'
            : 'border-border/60 hover:border-foreground/20 bg-card/50 text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
        {adminOnly && <Badge variant="secondary" className="text-[10px] h-4 px-1">Admin</Badge>}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top-level section nav */}
      <div className="flex items-center gap-2 flex-wrap">
        {navBtn('attributes', SettingsIcon, 'Attributs')}
        {navBtn('invoicing', FileText, 'Facturation')}
        {navBtn('tax', Percent, 'Taux imposition')}
        {navBtn('reminders', Bell, 'Rappels')}
        {navBtn('ai', Sparkles, 'IA')}
        {navBtn('email', Mail, 'Email')}
        {navBtn('users', Users, 'Utilisateurs', true)}
        {navBtn('maintenance', HardDrive, 'Maintenance', true)}
        {navBtn('howto', BookOpen, 'Guide')}
      </div>

      {section === 'users' && isAdmin ? (
        <UsersManagement />
      ) : section === 'invoicing' ? (
        <InvoicingSection />
      ) : section === 'tax' ? (
        <TaxSection />
      ) : section === 'reminders' ? (
        <RemindersSection />
      ) : section === 'ai' ? (
        <AISection />
      ) : section === 'email' ? (
        <EmailSection />
      ) : section === 'maintenance' && isAdmin ? (
        <MaintenanceSection />
      ) : section === 'howto' ? (
        <HowToSection />
      ) : (
        <AttributesSection />
      )}
    </div>
  )
}

function AttributesSection() {
  const confirm = useConfirm()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const { attributes, loading, refresh } = useSettings()
  const [activeTab, setActiveTab] = useState<AttributeType>('condition')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Attribute | null>(null)

  const tab = TABS.find(t => t.type === activeTab)!
  const list = attributes.filter(a => a.type === activeTab)

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Supprimer cet attribut ?',
      description: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    })
    if (!ok) return
    const res = await fetch(`/api/settings/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Attribut supprimé')
      refresh()
    } else {
      toast.error('Erreur')
    }
  }

  const setDefault = async (id: string) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isDefault: true }),
    })
    if (res.ok) {
      toast.success('Valeur par défaut mise à jour')
      refresh()
    } else {
      toast.error('Erreur')
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-card dark:to-emerald-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Paramètres articles</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Gestion des attributs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personnalisez les catégories, états, tailles et couleurs disponibles dans tous les formulaires de l'application.
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {TABS.map(t => {
          const Icon = t.icon
          const active = activeTab === t.type
          const count = attributes.filter(a => a.type === t.type).length
          return (
            <button
              key={t.type}
              onClick={() => setActiveTab(t.type)}
              className={cn(
                'p-4 rounded-xl border text-left transition-all',
                active
                  ? 'border-foreground/30 bg-card shadow-sm'
                  : 'border-border/60 hover:border-foreground/20 bg-card/50'
              )}
            >
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-2', t.accent)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t.label}</p>
                <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <tab.icon className="h-4 w-4" /> {tab.label}
              </CardTitle>
              <CardDescription className="mt-1">{tab.description}</CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => { setEditing(null); setShowForm(true) }} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Ajouter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center">
              <tab.icon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Aucune {tab.singular.toLowerCase()}</p>
              <p className="text-xs text-muted-foreground mt-1">Cliquez sur "Ajouter" pour en créer une.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Code interne</TableHead>
                  <TableHead>Libellé affiché</TableHead>
                  {activeTab === 'subcategory' && <TableHead>Catégorie parente</TableHead>}
                  {activeTab === 'carrier' && <TableHead>URL de suivi</TableHead>}
                  <TableHead className="text-center">Défaut</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...list].sort((a, b) => a.sortOrder - b.sortOrder).map(attr => (
                  <TableRow key={attr.id}>
                    <TableCell className="text-center text-xs text-muted-foreground">{attr.sortOrder + 1}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{attr.code}</code>
                    </TableCell>
                    <TableCell className="font-medium">{attr.value}</TableCell>
                    {activeTab === 'subcategory' && (
                      <TableCell>
                        {attr.parentCode ? (
                          <Badge variant="secondary" className="text-xs">
                            {attributes.find(a => a.type === 'category' && a.code === attr.parentCode)?.value || attr.parentCode}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                    )}
                    {activeTab === 'carrier' && (
                      <TableCell className="max-w-[280px]">
                        {attr.trackingUrl ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono truncate block max-w-[220px]" title={attr.trackingUrl}>
                              {attr.trackingUrl}
                            </code>
                            <a
                              href={attr.trackingUrl.replace('{tracking}', 'TEST123')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 hover:text-sky-700 shrink-0"
                              title="Tester l'URL"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Non configurée</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      {attr.isDefault ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">
                          <Star className="h-3 w-3 mr-1 fill-current" /> Défaut
                        </Badge>
                      ) : isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setDefault(attr.id)}
                        >
                          Définir
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setEditing(attr); setShowForm(true) }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                            onClick={() => handleDelete(attr.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info note */}
      {!isAdmin && (
        <Card className="border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-sky-700 dark:text-sky-300 mb-1">Lecture seule</p>
              <p className="text-xs text-sky-700/80 dark:text-sky-300/80">
                Votre rôle Staff ne permet pas de modifier les attributs. Contactez un administrateur pour ajouter ou modifier des catégories, états, tailles, couleurs ou transporteurs.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {isAdmin && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">Bon à savoir</p>
              <ul className="text-xs text-amber-700/80 dark:text-amber-300/80 space-y-1 list-disc pl-4">
                <li>Le <strong>code interne</strong> est utilisé dans la base de données (ex. <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">vetements</code>)</li>
                <li>Le <strong>libellé affiché</strong> est ce que vous voyez dans les menus déroulants (ex. <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">Vêtements</code>)</li>
                <li>La <strong>valeur par défaut</strong> sera pré-sélectionnée dans les formulaires de création d&apos;article</li>
                <li>Les attributs existants déjà utilisés dans des articles ne doivent pas être supprimés</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <AttributeForm
        open={showForm}
        onOpenChange={setShowForm}
        attribute={editing}
        tab={tab}
        onSaved={() => { setShowForm(false); refresh() }}
      />
    </div>
  )
}

function AttributeForm({ open, onOpenChange, attribute, tab, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  attribute: Attribute | null
  tab: TabDef
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    value: '',
    code: '',
    trackingUrl: '',
    parentCode: '',
    isDefault: false,
  })

  // Get categories for parentCode select (subcategories only)
  const { attributes: allAttrs } = useSettings()
  const categories = allAttrs.filter(a => a.type === 'category')

  // Sync form when attribute changes
  if (open && attribute && form.value === '' && form.code === '' && form.value !== attribute.value) {
    setForm({
      value: attribute.value,
      code: attribute.code,
      trackingUrl: attribute.trackingUrl || '',
      parentCode: attribute.parentCode || '',
      isDefault: attribute.isDefault,
    })
  }
  if (open && !attribute && (form.value !== '' || form.code !== '') && !saving) {
    // Reset when opening for create mode
    // (handled by key prop in Dialog)
  }

  const reset = () => {
    setForm({ value: '', code: '', trackingUrl: '', parentCode: '', isDefault: false })
  }

  const submit = async () => {
    if (!form.value || !form.code) {
      toast.error('Code et libellé requis')
      return
    }
    setSaving(true)
    try {
      const url = '/api/settings'
      const method = attribute ? 'PATCH' : 'POST'
      const body = attribute
        ? { id: attribute.id, value: form.value, code: form.code, isDefault: form.isDefault, trackingUrl: form.trackingUrl, parentCode: form.parentCode || null }
        : { type: tab.type, value: form.value, code: form.code, isDefault: form.isDefault, trackingUrl: form.trackingUrl, parentCode: form.parentCode || null }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      toast.success(attribute ? 'Attribut modifié' : `${tab.singular} ajoutée`)
      reset()
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose} key={attribute?.id || 'new'}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <tab.icon className="h-4 w-4" />
            {attribute ? `Modifier ${tab.singular.toLowerCase()}` : `Nouvelle ${tab.singular.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {attribute ? `Code: ${attribute.code}` : `Ajoutez une nouvelle ${tab.singular.toLowerCase()} à la liste.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Code interne *</Label>
            <Input
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder={tab.codePlaceholder}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Utilisé en base de données. Évitez les espaces et accents.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé affiché *</Label>
            <Input
              value={form.value}
              onChange={e => setForm({ ...form, value: e.target.value })}
              placeholder={tab.valuePlaceholder}
            />
            <p className="text-[11px] text-muted-foreground">
              Ce texte apparaîtra dans les menus déroulants.
            </p>
          </div>
          {tab.type === 'subcategory' && (
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs">Catégorie parente *</Label>
              <Select
                value={form.parentCode || '__none__'}
                onValueChange={v => setForm({ ...form, parentCode: v === '__none__' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                La sous-catégorie sera liée à cette catégorie parente.
              </p>
            </div>
          )}
          {tab.type === 'carrier' && (
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs">URL de suivi</Label>
              <Input
                value={form.trackingUrl}
                onChange={e => setForm({ ...form, trackingUrl: e.target.value })}
                placeholder="https://www.mondialrelay.fr/suivi-de-colis?NumeroExpedition={tracking}"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Utilisez <code className="bg-muted px-1 py-0.5 rounded">{'{tracking}'}</code> comme variable — elle sera remplacée par le n° de suivi réel au moment du clic.
              </p>
              {form.trackingUrl && !form.trackingUrl.includes('{tracking}') && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Astuce : ajoutez <code className="bg-amber-100 dark:bg-amber-950 px-1 py-0.5 rounded">{'{tracking}'}</code> dans l'URL pour qu'elle soit automatiquement complétée.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={form.isDefault}
              onChange={e => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="isDefault" className="text-sm cursor-pointer">
              Définir comme valeur par défaut
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement...' : (attribute ? 'Modifier' : 'Ajouter')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
//  InvoicingSection — Paramètres de facturation
// ============================================================

interface InvoiceSettings {
  id: string
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
  vatExemptionText: string
  invoicePrefix: string
  invoiceCounter: number
  invoicePadLength: number
  legalMentions: string | null
}

function InvoicingSection() {
  const { data, loading } = useFetch<InvoiceSettings>('/api/invoice-settings')
  const [form, setForm] = useState<InvoiceSettings | null>(null)
  const [saving, setSaving] = useState(false)

  // Sync form once data loads
  if (data && form === null) {
    setForm(data)
  }

  const set = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async () => {
    if (!form) return
    if (!form.companyName?.trim()) {
      toast.error('Le nom de la société est requis')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/invoice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      const updated = (await res.json()) as InvoiceSettings
      setForm(updated)
      toast.success('Paramètres de facturation enregistrés')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  // Build counter preview
  const year = new Date().getFullYear()
  const padded = String(form.invoiceCounter).padStart(form.invoicePadLength, '0')
  const counterPreview = `${form.invoicePrefix.replace('{YEAR}', String(year))}${padded}`

  return (
    <div className="space-y-5 pb-24">
      {/* Hero */}
      <Card className="border-sky-200 dark:border-sky-900 bg-gradient-to-br from-sky-50 via-white to-sky-50/30 dark:from-sky-950/30 dark:via-card dark:to-sky-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-sky-600" />
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">Facturation</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Paramètres de facturation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les informations légales de votre société et la numérotation de vos factures.
          </p>
        </CardContent>
      </Card>

      {/* Société émettrice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Société émettrice
          </CardTitle>
          <CardDescription>Informations affichées en haut de chaque facture.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Nom de la société *</Label>
            <Input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Ma Société SARL" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Adresse</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="12 rue du Commerce" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Code postal</Label>
            <Input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} placeholder="75001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ville</Label>
            <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Paris" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pays</Label>
            <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="France" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email || ''} onChange={e => set('email', e.target.value || null)} placeholder="contact@masociete.fr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Téléphone</Label>
            <Input value={form.phone || ''} onChange={e => set('phone', e.target.value || null)} placeholder="01 23 45 67 89" />
          </div>
        </CardContent>
      </Card>

      {/* Identifiants légaux */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Identifiants légaux
          </CardTitle>
          <CardDescription>SIRET et RCS affichés dans le pied de page de la facture.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">SIRET</Label>
            <Input value={form.siret || ''} onChange={e => set('siret', e.target.value || null)} placeholder="123 456 789 00012" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">RCS</Label>
            <Input value={form.rcs || ''} onChange={e => set('rcs', e.target.value || null)} placeholder="Paris 123 456 789" className="font-mono" />
          </div>
        </CardContent>
      </Card>

      {/* TVA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> TVA
          </CardTitle>
          <CardDescription>Activez la TVA si votre société y est assujettie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">TVA applicable</p>
              <p className="text-xs text-muted-foreground">Cochez si vous êtes assujetti à la TVA.</p>
            </div>
            <Switch checked={form.vatEnabled} onCheckedChange={v => set('vatEnabled', v)} />
          </div>
          {form.vatEnabled ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Numéro de TVA intracommunautaire</Label>
                <Input value={form.vatNumber || ''} onChange={e => set('vatNumber', e.target.value || null)} placeholder="FR12345678901" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taux de TVA (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.vatRate}
                  onChange={e => set('vatRate', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Mention d'exonération de TVA affichée automatiquement sur vos factures. Personnalisez le texte ci-dessous si la mention légale évolue.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mention d'exonération TVA (affichée sur les factures)</Label>
                <Input
                  value={form.vatExemptionText || ''}
                  onChange={e => set('vatExemptionText', e.target.value)}
                  placeholder="TVA non applicable, art. 293 B du CGI — franchise en base"
                />
                <p className="text-[11px] text-muted-foreground">
                  Par défaut : « TVA non applicable, art. 293 B du CGI — franchise en base »
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Numérotation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Numérotation des factures
          </CardTitle>
          <CardDescription>Personnalisez le format et le compteur de vos numéros de facture.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Préfixe des factures</Label>
              <Input
                value={form.invoicePrefix}
                onChange={e => set('invoicePrefix', e.target.value)}
                placeholder="F-{YEAR}-"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Utilisez <code className="bg-muted px-1 py-0.5 rounded">{'{YEAR}'}</code> pour insérer l&apos;année courante.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Longueur du compteur (zéros de remplissage)</Label>
              <Select
                value={String(form.invoicePadLength)}
                onValueChange={v => set('invoicePadLength', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 (01 à 99)</SelectItem>
                  <SelectItem value="3">3 (001 à 999)</SelectItem>
                  <SelectItem value="4">4 (0001 à 9999)</SelectItem>
                  <SelectItem value="5">5 (00001 à 99999)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Nombre de chiffres du compteur.</p>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground uppercase mb-1">Aperçu du prochain numéro</p>
            <code className="text-base font-mono font-semibold">{counterPreview}</code>
            <p className="text-[11px] text-muted-foreground mt-1">
              Compteur actuel : <strong>{form.invoiceCounter}</strong> — le prochain numéro sera {form.invoiceCounter + 1}.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mentions légales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Mentions légales
          </CardTitle>
          <CardDescription>Texte affiché en bas de chaque facture (conditions de paiement, retard, etc.).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Textarea
            value={form.legalMentions || ''}
            onChange={e => set('legalMentions', e.target.value || null)}
            placeholder="Paiement par virement sous 30 jours. Escompte pour paiement anticipé : néant. Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40€."
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Les modifications sont appliquées aux nouvelles factures.
          </p>
          <Button onClick={save} disabled={saving} className="ml-auto">
            {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  AISection — Configuration du fournisseur IA
// ============================================================

interface AIProviderInfo {
  label: string
  description: string
  defaultModel: string
  models: string[]
  apiKeyUrl: string
  free: boolean
}

interface AIConfigData {
  id: string
  provider: string
  apiKey: string | null
  hasApiKey: boolean
  model: string | null
  providers: Record<string, AIProviderInfo>
}

function AISection() {
  const { data, loading, refresh } = useFetch<AIConfigData>('/api/ai/config')
  const [provider, setProvider] = useState<string>('zai')
  const [apiKey, setApiKey] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Sync local state once data loads
  if (data && provider === 'zai' && !apiKey && model === '' && data.provider !== provider) {
    setProvider(data.provider)
    setModel(data.model || '')
  } else if (data && provider === 'zai' && data.provider === 'zai' && !apiKey && model === '' && data.model) {
    setModel(data.model)
  }

  const currentProvider = data?.providers?.[provider]
  const hasApiKeySet = !!data?.hasApiKey && data?.provider === provider

  const selectProvider = (p: string) => {
    setProvider(p)
    const info = data?.providers?.[p]
    if (info && (!model || !info.models.includes(model))) {
      setModel(info.defaultModel || '')
    }
    setApiKey('')
  }

  const save = async () => {
    setSaving(true)
    try {
      const body: { provider: string; apiKey?: string; model: string | null } = {
        provider,
        model: provider === 'zai' ? null : (model || currentProvider?.defaultModel || null),
      }
      if (apiKey && !apiKey.startsWith('••••')) {
        body.apiKey = apiKey
      }
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      toast.success('Configuration IA enregistrée')
      setApiKey('')
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/ai/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'Test',
          category: 'vetements',
          size: 'M',
          color: 'Noir',
          condition: 'bon',
          sku: 'TEST-001',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Erreur')
      }
      toast.success('Test réussi — le fournisseur IA fonctionne correctement', {
        description: json.description?.slice(0, 120) + '...',
      })
    } catch (e: unknown) {
      toast.error('Test échoué', {
        description: e instanceof Error ? e.message : 'Erreur',
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const activeProviderInfo = data.providers[provider]
  const showKeyInput = provider !== 'zai'

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="border-violet-200 dark:border-violet-900 bg-gradient-to-br from-violet-50 via-white to-violet-50/30 dark:from-violet-950/30 dark:via-card dark:to-violet-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">IA</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Intelligence artificielle</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choisissez le fournisseur IA utilisé pour générer automatiquement les descriptions de vos articles.
          </p>
        </CardContent>
      </Card>

      {/* Status & test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Fournisseur actif
          </CardTitle>
          <CardDescription>Vérifiez que la configuration fonctionne avec un article de test.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold">{data.providers[data.provider]?.label || data.provider}</p>
              <p className="text-xs text-muted-foreground">
                {data.hasApiKey || data.provider === 'zai' ? 'Configuré' : 'Clé API requise'} · Modèle : {data.model || data.providers[data.provider]?.defaultModel || 'défaut'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={test} disabled={testing}>
            {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {testing ? 'Test en cours...' : 'Tester'}
          </Button>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" /> Choisir un fournisseur
          </CardTitle>
          <CardDescription>Sélectionnez l&apos;IA que vous souhaitez utiliser.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(data.providers).map(([key, info]) => {
            const active = provider === key
            return (
              <button
                key={key}
                onClick={() => selectProvider(key)}
                className={cn(
                  'text-left p-4 rounded-xl border-2 transition-all',
                  active
                    ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 shadow-sm'
                    : 'border-border/60 hover:border-foreground/20 bg-card/50'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-sm">{info.label}</p>
                  {info.free && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100 text-[10px] h-5">
                      GRATUIT
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{info.description}</p>
                {active && (
                  <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-2 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Sélectionné
                  </p>
                )}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* API key + model (hidden for zai) */}
      {showKeyInput && activeProviderInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" /> Clé API & modèle — {activeProviderInfo.label}
            </CardTitle>
            <CardDescription>Renseignez votre clé API et choisissez un modèle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Clé API</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasApiKeySet ? `Clé enregistrée (${data.apiKey})` : 'Collez votre clé API ici'}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                La clé est stockée chiffrée dans la base. Laissez vide pour conserver la clé existante.
              </p>
            </div>
            {activeProviderInfo.models.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Modèle</Label>
                <Select value={model || activeProviderInfo.defaultModel} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProviderInfo.models.map(m => (
                      <SelectItem key={m} value={m}>
                        {m}
                        {m === activeProviderInfo.defaultModel && ' (défaut)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help card */}
      {activeProviderInfo && activeProviderInfo.apiKeyUrl && (
        <Card className="border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20">
          <CardContent className="p-4 flex gap-3 items-start">
            <Key className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-sky-700 dark:text-sky-300 mb-1">
                Obtenir une clé API pour {activeProviderInfo.label}
              </p>
              <p className="text-xs text-sky-700/80 dark:text-sky-300/80 mb-2">
                Créez un compte, générez une clé API puis collez-la dans le champ ci-dessus.
              </p>
              <a
                href={activeProviderInfo.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline"
              >
                <LinkIcon className="h-3 w-3" />
                {activeProviderInfo.apiKeyUrl}
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {provider === 'zai' && (
        <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-4 flex gap-3 items-start">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">Aucune configuration requise</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Le fournisseur Z.ai fonctionne immédiatement, sans clé API, sur la preview cloud.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
//  MaintenanceSection — Sauvegarde & restauration (admin)
// ============================================================

interface MaintenanceInfo {
  dbPath: string
  dbExists: boolean
  dbSize: number
  dbLastModified: string | null
  counts: {
    users: number
    suppliers: number
    stockItems: number
    sales: number
    expenses: number
    attributes: number
    invoiceSettings: number
  }
  backups: { name: string; size: number; createdAt: string }[]
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const k = 1024
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </div>
  )
}

function MaintenanceSection() {
  const confirm = useConfirm()
  const { data, loading, refresh } = useFetch<MaintenanceInfo>('/api/maintenance/info')
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createBackup = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/maintenance/backup')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      const blob = await res.blob()
      const backupName = res.headers.get('X-Backup-Name') || `backup-${Date.now()}.db`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Sauvegarde créée et téléchargée')
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setCreating(false)
    }
  }

  const downloadBackup = async (name: string) => {
    try {
      const res = await fetch(`/api/maintenance/backup?name=${encodeURIComponent(name)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Téléchargement démarré')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const deleteBackup = async (name: string) => {
    const ok = await confirm({
      title: `Supprimer la sauvegarde ?`,
      description: `Fichier : ${name}`,
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/maintenance/backup?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      toast.success('Sauvegarde supprimée')
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const doRestore = async () => {
    if (!restoreFile) {
      toast.error('Aucun fichier sélectionné')
      return
    }
    setRestoring(true)
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      const res = await fetch('/api/maintenance/restore', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Erreur')
      }
      toast.success(json.message || 'Restauration réussie')
      setRestoreFile(null)
      setConfirmRestore(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setRestoring(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="border-rose-200 dark:border-rose-900 bg-gradient-to-br from-rose-50 via-white to-rose-50/30 dark:from-rose-950/30 dark:via-card dark:to-rose-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-rose-600" />
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Maintenance</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Maintenance & sauvegarde</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sauvegardez, restaurez et inspectez la base de données SQLite de l&apos;application.
          </p>
        </CardContent>
      </Card>

      {/* DB info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Base de données
          </CardTitle>
          <CardDescription>Informations sur le fichier SQLite utilisé par l&apos;application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Taille</p>
              <p className="text-sm font-semibold">{formatBytes(data.dbSize)}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Dernière modif.</p>
              <p className="text-sm font-semibold">
                {data.dbLastModified ? new Date(data.dbLastModified).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Statut</p>
              <p className="text-sm font-semibold">
                {data.dbExists ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">Présente</Badge>
                ) : (
                  <Badge variant="destructive">Absente</Badge>
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Sauvegardes</p>
              <p className="text-sm font-semibold">{data.backups.length}</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Chemin</p>
            <code className="text-xs font-mono break-all">{data.dbPath}</code>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <StatBox label="Utilisateurs" value={data.counts.users} />
            <StatBox label="Fournisseurs" value={data.counts.suppliers} />
            <StatBox label="Articles" value={data.counts.stockItems} />
            <StatBox label="Ventes" value={data.counts.sales} />
            <StatBox label="Charges" value={data.counts.expenses} />
            <StatBox label="Attributs" value={data.counts.attributes} />
            <StatBox label="Facturations" value={data.counts.invoiceSettings} />
          </div>
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Sauvegarde
          </CardTitle>
          <CardDescription>Créez une copie de la base actuelle et téléchargez-la.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={createBackup} disabled={creating}>
            {creating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            {creating ? 'Création...' : 'Créer & télécharger une sauvegarde'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card className="border-rose-300 dark:border-rose-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <ShieldAlert className="h-4 w-4" /> Restauration
          </CardTitle>
          <CardDescription>Restaure la base depuis un fichier .db — opération irréversible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex gap-2 items-start">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Une sauvegarde de sécurité sera créée automatiquement avant la restauration. Redémarrez le serveur après restauration pour appliquer les changements.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={e => setRestoreFile(e.target.files?.[0] || null)}
              className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer flex-1"
            />
            <Button
              variant="destructive"
              onClick={() => setConfirmRestore(true)}
              disabled={!restoreFile || restoring}
            >
              <Upload className="h-4 w-4 mr-2" />
              Restaurer
            </Button>
          </div>
          {restoreFile && (
            <p className="text-xs text-muted-foreground">
              Fichier sélectionné : <strong>{restoreFile.name}</strong> ({formatBytes(restoreFile.size)})
            </p>
          )}
        </CardContent>
      </Card>

      {/* Backups list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Sauvegardes existantes
          </CardTitle>
          <CardDescription>Liste des fichiers de sauvegarde disponibles sur le serveur.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.backups.length === 0 ? (
            <div className="py-12 text-center">
              <Database className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Aucune sauvegarde</p>
              <p className="text-xs text-muted-foreground mt-1">Créez une première sauvegarde avec le bouton ci-dessus.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nom</TableHead>
                  <TableHead className="w-32">Taille</TableHead>
                  <TableHead className="w-48">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.backups.map(b => (
                  <TableRow key={b.name}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{b.name}</code>
                    </TableCell>
                    <TableCell className="text-sm">{formatBytes(b.size)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => downloadBackup(b.name)}
                          title="Télécharger"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                          onClick={() => deleteBackup(b.name)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm restore modal */}
      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
              Confirmer la restauration
            </DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de remplacer la base de données actuelle par le fichier <strong>{restoreFile?.name}</strong>. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex gap-2 items-start">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Une sauvegarde de sécurité sera créée automatiquement. Redémarrez le serveur après la restauration pour appliquer les changements.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(false)}>Annuler</Button>
            <Button variant="destructive" onClick={doRestore} disabled={restoring}>
              {restoring ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {restoring ? 'Restauration...' : 'Restaurer maintenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION TAUX D'IMPOSITION — Cotisations URSSAF
// ═══════════════════════════════════════════════════════════════════════════

interface TaxSettingsData {
  id: string
  activityType: string
  taxRate: number
  activityTypes: Record<string, { label: string; defaultRate: number; description: string }>
}

function TaxSection() {
  const { data: settings, loading, refresh } = useFetch<TaxSettingsData>('/api/tax-rates')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ activityType: string; taxRate: string } | null>(null)

  if (settings && !form) {
    setForm({ activityType: settings.activityType, taxRate: String(settings.taxRate) })
  }

  const updateActivityType = (type: string) => {
    if (!settings) return
    const defaultRate = settings.activityTypes[type]?.defaultRate
    setForm({ activityType: type, taxRate: defaultRate ? String(defaultRate) : form?.taxRate || '12.3' })
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/tax-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      toast.success('Taux d\'imposition enregistré')
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const currentActivity = settings.activityTypes[form.activityType]

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-card dark:to-amber-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Taux d'imposition URSSAF</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Cotisations sociales</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sélectionnez votre catégorie d'activité. Le taux de cotisation URSSAF sera appliqué automatiquement dans la déclaration URSSAF du module Fiscalité.
          </p>
        </CardContent>
      </Card>

      {/* Catégorie d'activité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catégorie d'activité</CardTitle>
          <CardDescription>Sélectionnez votre type d'activité principale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(settings.activityTypes).map(([key, at]) => {
              const active = form.activityType === key
              return (
                <button
                  key={key}
                  onClick={() => updateActivityType(key)}
                  className={cn(
                    'text-left p-4 rounded-lg border-2 transition-all',
                    active
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-border hover:border-foreground/30'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{at.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-amber-600" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{at.description}</p>
                  <p className="text-xs font-mono mt-1 text-amber-600">{at.defaultRate}% par défaut</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Taux modifiable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taux de cotisation</CardTitle>
          <CardDescription>
            {currentActivity ? `Par défaut : ${currentActivity.defaultRate}% — modifiable selon votre situation` : 'Modifiable selon votre situation'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Taux de cotisation URSSAF (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.taxRate}
                onChange={e => setForm({ ...form, taxRate: e.target.value })}
                className="text-lg font-bold"
              />
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-600">{form.taxRate}%</p>
              <p className="text-xs text-muted-foreground">du CA</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/40 text-xs space-y-1">
            <p className="font-medium text-amber-700 dark:text-amber-300">💡 Exemple de calcul</p>
            <p className="text-muted-foreground">
              Pour un CA mensuel de 1 000€ : cotisation = 1 000 × {form.taxRate}% = <strong className="text-foreground">{(1000 * parseFloat(form.taxRate || '0') / 100).toFixed(2)}€</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setForm({ activityType: settings.activityType, taxRate: String(settings.taxRate) })}>
          Annuler
        </Button>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION RAPPELS — Actions récurrentes
// ═══════════════════════════════════════════════════════════════════════════

interface Reminder {
  id: string
  title: string
  description: string | null
  category: string
  frequency: string
  intervalNum: number
  lastDone: string | null
  nextDue: string
  dismissed: boolean
}

const REMINDER_CATEGORIES = [
  { id: 'urssaf', label: 'URSSAF', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'stock', label: 'Stock', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'compta', label: 'Comptabilité', color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'general', label: 'Général', color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
]

const REMINDER_FREQUENCIES = [
  { id: 'daily', label: 'Jour(s)' },
  { id: 'weekly', label: 'Semaine(s)' },
  { id: 'monthly', label: 'Mois' },
  { id: 'quarterly', label: 'Trimestre(s)' },
  { id: 'yearly', label: 'Année(s)' },
]

const freqLabels: Record<string, string> = {
  daily: 'jour', weekly: 'semaine', monthly: 'mois', quarterly: 'trimestre', yearly: 'an',
}

function RemindersSection() {
  const confirm = useConfirm()
  const { data: res, loading, refresh } = useFetch<{ reminders: Reminder[]; dueReminders: Reminder[] }>('/api/reminders')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', category: 'general', frequency: 'monthly', intervalNum: '1', startDate: new Date().toISOString().split('T')[0],
  })

  const submit = async () => {
    if (!form.title) { toast.error('Titre requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Rappel créé')
      setForm({ title: '', description: '', category: 'general', frequency: 'monthly', intervalNum: '1', startDate: new Date().toISOString().split('T')[0] })
      setShowForm(false)
      refresh()
    } catch { toast.error('Erreur') }
    finally { setSaving(false) }
  }

  const markDone = async (r: Reminder) => {
    await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'done', frequency: r.frequency, intervalNum: r.intervalNum }),
    })
    toast.success('Action faite — prochaine échéance recalculée')
    refresh()
  }

  const resetDismissed = async (r: Reminder) => {
    await fetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    refresh()
  }

  const deleteReminder = async (id: string) => {
    const ok = await confirm({
      title: 'Supprimer ce rappel ?',
      description: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    })
    if (!ok) return
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    toast.success('Rappel supprimé')
    refresh()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>

  const reminders = res?.reminders || []
  const dueCount = res?.dueReminders?.length || 0
  const now = new Date()

  return (
    <div className="space-y-5">
      <Card className="border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-card dark:to-amber-950/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Rappels & actions récurrentes</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">{reminders.length} rappel{reminders.length > 1 ? 's' : ''}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {dueCount > 0 ? <span className="text-rose-600 font-medium">{dueCount} action{dueCount > 1 ? 's' : ''} en retard — popup affiché au démarrage</span> : 'Aucun rappel en attente'}
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Nouveau rappel</Button>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nouveau rappel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre de l'action *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Déclaration URSSAF trimestrielle" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optionnel)</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Détails de l'action à mener..." />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tous les</Label>
                <Input type="number" min="1" value={form.intervalNum} onChange={e => setForm({ ...form, intervalNum: e.target.value })} className="text-center font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fréquence</Label>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_FREQUENCIES.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">À partir du</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={submit} disabled={saving}>{saving ? 'Création...' : 'Créer le rappel'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des rappels */}
      {reminders.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Aucun rappel</p>
          <p className="text-xs text-muted-foreground mt-1">Créez votre premier rappel pour ne plus oublier vos actions récurrentes.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reminders.map(r => {
            const isDue = new Date(r.nextDue) <= now
            const isDismissed = r.dismissed
            const cat = REMINDER_CATEGORIES.find(c => c.id === r.category) || REMINDER_CATEGORIES[3]
            return (
              <Card key={r.id} className={cn('transition-all', isDue && !isDismissed && 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/10', isDismissed && 'opacity-60')}>
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cat.color)}>{cat.label}</span>
                      {isDue && !isDismissed && <Badge variant="destructive" className="text-[9px] h-4 px-1 animate-pulse">EN RETARD</Badge>}
                      {isDismissed && <span className="text-[10px] text-muted-foreground italic">reporté</span>}
                    </div>
                    <p className="font-semibold text-sm">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Prochaine : {formatDate(r.nextDue)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Tous les {r.intervalNum} {freqLabels[r.frequency] || r.frequency}{r.intervalNum > 1 ? 's' : ''}</span>
                      {r.lastDone && <span>Dernier : {formatDate(r.lastDone)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isDue && !isDismissed && (
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markDone(r)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Fait
                      </Button>
                    )}
                    {isDismissed && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resetDismissed(r)}>
                        Réafficher
                      </Button>
                    )}
                    {!isDue && !isDismissed && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markDone(r)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Fait
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600" onClick={() => deleteReminder(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5 inline mr-1" />
            Les rappels apparaissent automatiquement dans une popup au démarrage de l'application quand une action est due. Cliquez sur "Fait" pour la marquer comme effectuée et recalculer la prochaine échéance, ou "Plus tard" pour la reporter.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION BOUTIQUE — Configuration storefront
// ═══════════════════════════════════════════════════════════════════════════

interface BoutiqueSettings {
  id: string
  heroTitle: string
  heroSubtitle: string
  heroCtaLabel: string
  heroCtaLink: string
  topBarText: string
  footerAbout: string
  footerEmail: string
  footerPhone: string | null
  logoText: string
  logoSubtitle: string
  primaryColor: string
  freeShippingThreshold: number
}

interface ShippingMethod {
  id: string
  code: string
  label: string
  price: number
  delay: string
  active: boolean
  order: number
}

interface BoutiqueCategory {
  slug: string
  label: string
  backgroundImage: string | null
  emoji: string
  order: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION EMAIL — Configuration SMTP + Templates
// ═══════════════════════════════════════════════════════════════════════════

interface EmailSettingsData {
  smtpHost: string | null
  smtpPort: number
  smtpUser: string | null
  smtpPassword: string | null
  smtpSecure: boolean
  fromEmail: string | null
  fromName: string | null
  templateRegister: string | null
  templateValidate: string | null
  templatePasswordLost: string | null
  templateOrder: string | null
  templateOrderStatus: string | null
}

// Modern HTML preset generator for email templates.
// Returns an HTML string with inline styles (email-client compatible).
function getModernPreset(templateType: string): string {
  const shopName = 'Votre Boutique'
  const accent = '#007bff'
  const accentDark = '#0056b3'
  const footer = `© ${new Date().getFullYear()} ${shopName}. Tous droits réservés.`

  const header = `
  <div style="background:linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${shopName}</h1>
  </div>`

  const footerBlock = `
  <div style="background:#f8f9fa;padding:20px 24px;text-align:center;border-radius:0 0 12px 12px;color:#6c757d;font-size:12px;">
    <p style="margin:0;">${footer}</p>
  </div>`

  const wrap = (title: string, bodyHtml: string, buttonText?: string, buttonLink?: string) => {
    const button = buttonText && buttonLink
      ? `<a href="${buttonLink}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:24px;font-weight:600;margin-top:16px;">${buttonText}</a>`
      : ''
    return `<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
${header}
  <div style="padding:32px 24px;text-align:center;color:#212529;">
    <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#212529;">${title}</h2>
    <div style="font-size:15px;line-height:1.6;color:#495057;">${bodyHtml}</div>
    ${button}
  </div>
${footerBlock}
</div>`
  }

  switch (templateType) {
    case 'templateRegister':
      return wrap(
        'Bienvenue {firstName} ! 👋',
        '<p>Nous sommes ravis de vous compter parmi nos clients.</p><p>Votre compte a été créé avec succès. Connectez-vous à tout moment pour suivre vos commandes et gérer vos informations.</p>',
        'Accéder à mon compte',
        '/boutique/connexion',
      )
    case 'templateValidate':
      return wrap(
        'Validez votre compte',
        '<p>Bonjour {firstName},</p><p>Pour activer votre compte et profiter de toutes nos offres, veuillez valider votre adresse email en cliquant sur le bouton ci-dessous.</p>',
        'Valider mon compte',
        '/boutique/connexion',
      )
    case 'templatePasswordLost':
      return wrap(
        'Réinitialisation de votre mot de passe',
        '<p>Bonjour {firstName},</p><p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien est valable 1 heure.</p>',
        'Réinitialiser mon mot de passe',
        '/boutique/connexion',
      )
    case 'templateOrder':
      return wrap(
        'Merci pour votre commande ! 🎉',
        '<p>Bonjour {firstName},</p><p>Nous confirmons la bonne réception de votre commande <strong>{orderId}</strong> d\'un montant de <strong>{total}</strong>.</p><p>Nous préparons votre colis avec soin et vous tiendrons informé(e) de son expédition.</p>',
        'Suivre ma commande',
        '/boutique/compte/commandes',
      )
    case 'templateOrderStatus':
      return wrap(
        'Mise à jour de votre commande {orderId}',
        '<p>Bonjour {firstName},</p><p>Le statut de votre commande <strong>{orderId}</strong> a été mis à jour :</p><p style="display:inline-block;background:#e7f1ff;color:' + accent + ';padding:6px 16px;border-radius:16px;font-weight:600;">{status}</p><p>Connectez-vous à votre espace client pour plus de détails.</p>',
        'Voir ma commande',
        '/boutique/compte/commandes',
      )
    default:
      return wrap('Bonjour {firstName}', '<p>Votre message ici.</p>')
  }
}

function EmailSection() {
  const [form, setForm] = useState<EmailSettingsData | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [emailDesign, setEmailDesign] = useState<string>('modern')
  const [savingDesign, setSavingDesign] = useState(false)

  useEffect(() => {
    fetch('/api/email-settings')
      .then(r => r.json())
      .then(data => setForm(data))
      .catch(() => {})
    // Fetch emailDesign from BoutiqueSettings
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => { if (typeof data.emailDesign === 'string') setEmailDesign(data.emailDesign) })
      .catch(() => {})
  }, [])

  const set = (k: keyof EmailSettingsData, v: any) => {
    setForm(prev => prev ? { ...prev, [k]: v } : null)
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Configuration email sauvegardée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const saveDesign = async (value: string) => {
    setEmailDesign(value)
    setSavingDesign(true)
    try {
      const res = await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailDesign: value }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Design des emails mis à jour')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSavingDesign(false)
    }
  }

  const testEmail = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/email-settings/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Échec du test')
      } else {
        toast.success('Email de test envoyé ! Vérifiez votre boîte.')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setTesting(false)
    }
  }

  if (!form) return <Skeleton className="h-64" />

  return (
    <div className="space-y-4">
      {/* SMTP Server */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Serveur SMTP</CardTitle>
          <CardDescription>Configurez votre serveur d'envoi d'emails (OVH, Gmail, SendGrid, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Hôte SMTP</Label>
              <Input value={form.smtpHost || ''} onChange={e => set('smtpHost', e.target.value)} placeholder="ssl0.ovh.net" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input type="number" value={form.smtpPort} onChange={e => set('smtpPort', parseInt(e.target.value) || 587)} placeholder="587" className="font-mono text-sm" />
              <p className="text-[11px] text-muted-foreground">587 (TLS) ou 465 (SSL)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Connexion sécurisée</Label>
              <Select value={form.smtpSecure ? 'true' : 'false'} onValueChange={v => set('smtpSecure', v === 'true')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">TLS (port 587)</SelectItem>
                  <SelectItem value="true">SSL (port 465)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Utilisateur</Label>
              <Input value={form.smtpUser || ''} onChange={e => set('smtpUser', e.target.value)} placeholder="contact@dboxpro.fr" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mot de passe</Label>
              <Input type="password" value={form.smtpPassword || ''} onChange={e => set('smtpPassword', e.target.value)} placeholder="••••••••" className="font-mono text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expéditeur */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expéditeur</CardTitle>
          <CardDescription>Adresse et nom affichés sur vos emails</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email expéditeur</Label>
            <Input value={form.fromEmail || ''} onChange={e => set('fromEmail', e.target.value)} placeholder="noreply@dboxpro.fr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nom expéditeur</Label>
            <Input value={form.fromName || ''} onChange={e => set('fromName', e.target.value)} placeholder="DBoxPro Boutique" />
          </div>
        </CardContent>
      </Card>

      {/* Design des emails */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Design des emails</CardTitle>
          <CardDescription>Choisissez le style visuel appliqué aux emails envoyés automatiquement par la boutique.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'modern', label: 'Moderne', desc: 'Dégradé, bords arrondis, boutons colorés' },
              { value: 'classic', label: 'Classique', desc: 'Mise en page sobre et traditionnelle' },
              { value: 'minimal', label: 'Minimaliste', desc: 'Épuré, noir et blanc, sans fioritures' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => saveDesign(opt.value)}
                className={cn(
                  'text-left p-3 rounded-md border transition-colors',
                  emailDesign === opt.value
                    ? 'border-foreground/40 bg-card shadow-sm'
                    : 'border-border/60 hover:border-foreground/20 bg-card/50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {emailDesign === opt.value && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {savingDesign ? 'Sauvegarde…' : 'Le design est sauvegardé automatiquement dès que vous le sélectionnez.'}
          </p>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modèles d'emails</CardTitle>
          <CardDescription>Personnalisez les emails envoyés automatiquement (HTML autorisé). Variables : {`{firstName}, {lastName}, {email}, {orderId}, {total}, {status}`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {[
            { key: 'templateRegister' as const, label: 'Inscription client', placeholder: 'Bienvenue {firstName} ! Votre compte a été créé avec succès.' },
            { key: 'templateValidate' as const, label: 'Validation du compte', placeholder: 'Bonjour {firstName}, veuillez valider votre adresse email…' },
            { key: 'templatePasswordLost' as const, label: 'Mot de passe perdu', placeholder: 'Bonjour {firstName}, voici votre lien de réinitialisation…' },
            { key: 'templateOrder' as const, label: 'Nouvelle commande', placeholder: 'Merci {firstName} ! Votre commande {orderId} d\'un montant de {total}€ a bien été enregistrée.' },
            { key: 'templateOrderStatus' as const, label: 'Changement de statut commande', placeholder: 'Bonjour {firstName}, le statut de votre commande {orderId} est maintenant : {status}.' },
          ].map(t => (
            <div key={t.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">{t.label}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => set(t.key, getModernPreset(t.key))}
                  title="Charger un modèle moderne pré-rempli"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Charger un modèle
                </Button>
              </div>
              <HtmlEditor
                value={form[t.key] || ''}
                onChange={(html) => set(t.key, html)}
                placeholder={t.placeholder}
                minHeight={200}
              />
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Si un modèle est vide, un texte par défaut sera utilisé. Cliquez sur « Charger un modèle » pour démarrer avec un design moderne pré-rempli.</p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={testEmail} disabled={testing || !form.smtpHost}>
          {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          {testing ? 'Envoi...' : 'Envoyer un email de test'}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-xs text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-1">💡 Fournisseurs SMTP courants :</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li><strong>OVH</strong> : ssl0.ovh.net, port 587 (TLS) ou 465 (SSL)</li>
          <li><strong>Gmail</strong> : smtp.gmail.com, port 587 (mot de passe d'application requis)</li>
          <li><strong>SendGrid</strong> : smtp.sendgrid.net, port 587, user = "apikey"</li>
          <li><strong>Brevo</strong> : smtp-relay.brevo.com, port 587</li>
        </ul>
      </div>
    </div>
  )
}


function BoutiqueSection() {
  const [tab, setTab] = useState<'general' | 'shipping' | 'categories' | 'payments'>('general')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" /> Configuration de la boutique
          </CardTitle>
          <CardDescription>
            Personnalisez le header, hero, footer, modes de livraison, paiements et images de catégories.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              size="sm"
              variant={tab === 'general' ? 'default' : 'outline'}
              onClick={() => setTab('general')}
            >
              Général (header/hero/footer)
            </Button>
            <Button
              size="sm"
              variant={tab === 'shipping' ? 'default' : 'outline'}
              onClick={() => setTab('shipping')}
            >
              Modes de livraison
            </Button>
            <Button
              size="sm"
              variant={tab === 'payments' ? 'default' : 'outline'}
              onClick={() => setTab('payments')}
            >
              Modes de paiement
            </Button>
            <Button
              size="sm"
              variant={tab === 'categories' ? 'default' : 'outline'}
              onClick={() => setTab('categories')}
            >
              Catégories (images)
            </Button>
          </div>

          {tab === 'general' && <BoutiqueGeneralTab />}
          {tab === 'shipping' && <BoutiqueShippingTab />}
          {tab === 'payments' && <BoutiquePaymentsTab />}
          {tab === 'categories' && <BoutiqueCategoriesTab />}
        </CardContent>
      </Card>
    </div>
  )
}

function BoutiqueGeneralTab() {
  const [form, setForm] = useState<BoutiqueSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => setForm(data))
      .catch(() => {})
  }, [])

  const set = (k: keyof BoutiqueSettings, v: any) => {
    setForm(prev => prev ? { ...prev, [k]: v } : null)
  }

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        toast.error('Erreur lors de la sauvegarde')
        return
      }
      toast.success('Configuration sauvegardée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <Skeleton className="h-64" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Texte logo (header)</Label>
          <Input value={form.logoText} onChange={e => set('logoText', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sous-titre logo</Label>
          <Input value={form.logoSubtitle} onChange={e => set('logoSubtitle', e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Top bar (bandeau en haut)</Label>
        <Input value={form.topBarText} onChange={e => set('topBarText', e.target.value)} />
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm font-semibold mb-3">Hero (section principale accueil)</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre du hero</Label>
            <Input value={form.heroTitle} onChange={e => set('heroTitle', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-titre du hero</Label>
            <Textarea value={form.heroSubtitle} onChange={e => set('heroSubtitle', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bouton CTA - texte</Label>
              <Input value={form.heroCtaLabel} onChange={e => set('heroCtaLabel', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bouton CTA - lien</Label>
              <Input value={form.heroCtaLink} onChange={e => set('heroCtaLink', e.target.value)} placeholder="#produits ou /boutique/categorie/..." />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm font-semibold mb-3">Footer</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">À propos (footer)</Label>
            <Textarea value={form.footerAbout} onChange={e => set('footerAbout', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email contact</Label>
              <Input value={form.footerEmail} onChange={e => set('footerEmail', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={form.footerPhone || ''} onChange={e => set('footerPhone', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm font-semibold mb-3">Livraison</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Seuil livraison offerte (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.freeShippingThreshold}
            onChange={e => set('freeShippingThreshold', parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="flex justify-end pt-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  )
}

function BoutiqueShippingTab() {
  const [methods, setMethods] = useState<ShippingMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', label: '', price: '', delay: '', active: true })

  const fetchMethods = () => {
    fetch('/api/boutique/admin/shipping')
      .then(r => r.json())
      .then(data => setMethods(data.methods || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMethods() }, [])

  const create = async () => {
    if (!form.code || !form.label) {
      toast.error('Code et libellé requis')
      return
    }
    const res = await fetch('/api/boutique/admin/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: parseFloat(form.price) || 0 }),
    })
    if (res.ok) {
      toast.success('Mode de livraison ajouté')
      setForm({ code: '', label: '', price: '', delay: '', active: true })
      setShowForm(false)
      fetchMethods()
    } else {
      toast.error('Erreur')
    }
  }

  const toggleActive = async (m: ShippingMethod) => {
    await fetch(`/api/boutique/admin/shipping/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    })
    fetchMethods()
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce mode de livraison ?')) return
    await fetch(`/api/boutique/admin/shipping/${id}`, { method: 'DELETE' })
    toast.success('Supprimé')
    fetchMethods()
  }

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-3">
      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucun mode de livraison. Ajoutez-en ci-dessous.</p>
      ) : (
        <div className="space-y-2">
          {methods.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 border rounded-md">
              <div className="flex-1">
                <p className="font-medium text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground">
                  Code: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{m.code}</code>
                  {m.delay && ` · ${m.delay}`}
                </p>
              </div>
              <Badge variant={m.active ? 'default' : 'secondary'}>
                {m.price === 0 ? 'Gratuit' : `${m.price.toFixed(2)} €`}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => toggleActive(m)}>
                {m.active ? 'Désactiver' : 'Activer'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(m.id)} className="text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <p className="text-sm font-semibold">Nouveau mode de livraison</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Code (unique)</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="express" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Libellé</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Express 24h" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prix (€)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="9.90" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Délai</Label>
              <Input value={form.delay} onChange={e => setForm({ ...form, delay: e.target.value })} placeholder="24h ouvrées" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button size="sm" onClick={create}>Créer</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un mode
        </Button>
      )}
    </div>
  )
}

function BoutiqueCategoriesTab() {
  const [cats, setCats] = useState<BoutiqueCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  const fetchCats = () => {
    fetch('/api/boutique/admin/categories')
      .then(r => r.json())
      .then(data => setCats(data.categories || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCats() }, [])

  const uploadImage = async (slug: string, file: File) => {
    setUploading(slug)
    try {
      const formData = new FormData()
      formData.append('file', file)
      // Use the existing upload endpoint or a dedicated one — we'll use the public/uploads path
      const res = await fetch('/api/boutique/admin/categories/upload', {
        method: 'POST',
        headers: { 'X-Category-Slug': slug },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur upload')
        return
      }
      // Update category with the image path
      await fetch('/api/boutique/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          label: cats.find(c => c.slug === slug)?.label || slug,
          emoji: cats.find(c => c.slug === slug)?.emoji || '📦',
          backgroundImage: data.path,
        }),
      })
      toast.success('Image mise à jour')
      fetchCats()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setUploading(null)
    }
  }

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground uppercase">
            <th className="px-3 py-2 font-medium">Catégorie</th>
            <th className="px-3 py-2 font-medium">Slug</th>
            <th className="px-3 py-2 font-medium">Image</th>
            <th className="px-3 py-2 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(c => (
            <tr key={c.slug} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-3 font-medium">
                {c.emoji} {c.label}
              </td>
              <td className="px-3 py-3">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{c.slug}</code>
              </td>
              <td className="px-3 py-3">
                <div className="w-20 h-14 rounded-md overflow-hidden border bg-muted">
                  {c.backgroundImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.backgroundImage} alt={c.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-2xl opacity-30">{c.emoji}</div>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-right">
                <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) uploadImage(c.slug, f)
                    }}
                  />
                  {uploading === c.slug ? 'Upload...' : 'Changer image'}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BoutiquePaymentsTab() {
  const [methods, setMethods] = useState<Array<{
    id: string; code: string; label: string; description: string | null;
    icon: string | null; provider: string; active: boolean; order: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    code: '', label: '', description: '', icon: '💳', provider: 'demo',
  })

  const fetchMethods = () => {
    fetch('/api/boutique/admin/payments')
      .then(r => r.json())
      .then(data => setMethods(data.methods || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMethods() }, [])

  const create = async () => {
    if (!form.code || !form.label) {
      toast.error('Code et libellé requis')
      return
    }
    const res = await fetch('/api/boutique/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast.success('Mode de paiement ajouté')
      setForm({ code: '', label: '', description: '', icon: '💳', provider: 'demo' })
      setShowForm(false)
      fetchMethods()
    } else {
      toast.error('Erreur')
    }
  }

  const toggleActive = async (m: typeof methods[0]) => {
    await fetch(`/api/boutique/admin/payments/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    })
    fetchMethods()
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce mode de paiement ?')) return
    await fetch(`/api/boutique/admin/payments/${id}`, { method: 'DELETE' })
    toast.success('Supprimé')
    fetchMethods()
  }

  const PROVIDERS = [
    { value: 'demo', label: 'Démo (simulation)' },
    { value: 'stripe', label: 'Stripe (CB réelle)' },
    { value: 'paypal', label: 'PayPal (réel)' },
    { value: 'manual', label: 'Manuel (virement, chèque...)' },
  ]

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
        💡 <strong>Mode démo :</strong> simule un paiement (aucune transaction réelle). <strong>Stripe/PayPal :</strong> nécessite clés API (à venir). <strong>Manuel :</strong> virement, chèque, etc.
      </div>

      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Aucun mode de paiement configuré. Les clients verront 3 modes par défaut (CB démo, PayPal démo, Virement).
        </p>
      ) : (
        <div className="space-y-2">
          {methods.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 border rounded-md">
              <span className="text-2xl">{m.icon || '💳'}</span>
              <div className="flex-1">
                <p className="font-medium text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground">
                  Code: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{m.code}</code>
                  {' · '}
                  {PROVIDERS.find(p => p.value === m.provider)?.label || m.provider}
                  {m.description && ` · ${m.description}`}
                </p>
              </div>
              <Badge variant={m.active ? 'default' : 'secondary'}>
                {m.active ? 'Actif' : 'Inactif'}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => toggleActive(m)}>
                {m.active ? 'Désactiver' : 'Activer'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(m.id)} className="text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <p className="text-sm font-semibold">Nouveau mode de paiement</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Code (unique)</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="cb_stripe" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Libellé</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Carte bancaire (Stripe)" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Icône (emoji)</Label>
              <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="💳" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={form.provider} onValueChange={v => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Paiement sécurisé par carte bancaire" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button size="sm" onClick={create}>Créer</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un mode
        </Button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION GUIDE — How To (documentation de configuration)
// ═══════════════════════════════════════════════════════════════════════════

function HowToSection() {
  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Guide de configuration</CardTitle>
          <CardDescription>Tout ce qu'il faut savoir pour configurer Reseller OS — de A à Z</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ce guide décrit chaque module et comment le configurer. Cliquez sur une section ci-dessous pour la déplier.
        </CardContent>
      </Card>

      <HowToCard title="1. Attributs" icon={SettingsIcon}>
        <p>Les attributs sont les valeurs réutilisables dans tout l'app :</p>
        <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
          <li><strong>États</strong> : neuf, très bon état, bon état, correct.</li>
          <li><strong>Tailles</strong> : XS, S, M, L, XL, 38, 40, 42, TU, etc.</li>
          <li><strong>Couleurs</strong> : Bleu, Rouge, Noir, etc.</li>
          <li><strong>Transporteurs</strong> : Colissimo, Chronopost, Mondial Relay — avec URL de suivi (format <code>{`{tracking}`}</code>).</li>
          <li><strong>Plateformes</strong> : Vinted, Leboncoin, eBay.</li>
          <li><strong>Lots d'origine</strong> : pour tracer vos achats en lot.</li>
        </ul>
        <p className="mt-2"><strong>Note :</strong> les catégories et sous-catégories sont gérées dans <em>Boutique Admin → Catégories</em>.</p>
      </HowToCard>

      <HowToCard title="2. Facturation" icon={FileText}>
        <p>Configurez votre société pour générer des factures :</p>
        <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
          <li><strong>Société émettrice</strong> : nom, adresse, SIRET, RCS, NAF, capital.</li>
          <li><strong>TVA</strong> : activez/désactivez (franchise en base si désactivé).</li>
          <li><strong>Numérotation</strong> : préfixe (ex: <code>F-{`{YEAR}`}-</code>), longueur du compteur.</li>
          <li><strong>Mentions légales</strong> : pied de page des factures.</li>
        </ul>
      </HowToCard>

      <HowToCard title="3. Taux d'imposition (URSSAF)" icon={Percent}>
        <p>Configurez votre régime fiscal :</p>
        <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
          <li><strong>Catégorie</strong> : achat-revente, prestation de service, etc.</li>
          <li><strong>Taux</strong> : pourcentage URSSAF (12,3% par défaut pour achat-revente).</li>
        </ul>
        <p className="mt-2">Alimente les rapports <strong>Fiscalité → Synthèse</strong> et <strong>Livre des recettes</strong>.</p>
      </HowToCard>

      <HowToCard title="4. Rappels" icon={Bell}>
        <p>Créez des rappels récurrents (journalier, hebdomadaire, mensuel, annuel). Les rappels apparaissent en pop-up à la connexion.</p>
      </HowToCard>

      <HowToCard title="5. Intelligence Artificielle" icon={Sparkles}>
        <p>Générez des descriptions de produits avec l'IA :</p>
        <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
          <li><strong>Z.ai</strong> : gratuit, aucune config requise.</li>
          <li><strong>Autres</strong> : Gemini, Mistral, OpenAI — nécessitent une clé API.</li>
        </ul>
      </HowToCard>

      <HowToCard title="6. Email (SMTP)" icon={Mail}>
        <p>Configurez l'envoi d'emails automatiques :</p>
        <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
          <li><strong>SMTP</strong> : hôte, port, sécurisé (SSL/TLS), utilisateur, mot de passe.</li>
          <li><strong>Design</strong> : 3 styles (Moderne, Classique, Minimaliste).</li>
          <li><strong>5 templates</strong> : Inscription, Validation, Mot de passe perdu, Commande, Statut commande.</li>
          <li><strong>Éditeur WYSIWYG</strong> : bouton "Charger un modèle" pour un design moderne.</li>
          <li><strong>Variables</strong> : <code>{`{firstName}`}</code>, <code>{`{orderId}`}</code>, <code>{`{total}`}</code>, <code>{`{status}`}</code>.</li>
          <li><strong>Email de suivi</strong> : si statut = Expédiée + n° de suivi → bloc "Suivi de votre colis" avec lien.</li>
          <li><strong>Astuce Gmail</strong> : utilisez un mot de passe d'application.</li>
        </ul>
      </HowToCard>

      <HowToCard title="7. Utilisateurs" icon={Users}>
        <p>Gérez les comptes staff :</p>
        <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
          <li><strong>Admin</strong> : accès complet (fiscalité, rentabilité, maintenance, utilisateurs).</li>
          <li><strong>Staff</strong> : accès limité (stock, ventes, sourcing, publication, colis, BI).</li>
        </ul>
      </HowToCard>

      <HowToCard title="8. Maintenance" icon={HardDrive}>
        <p>Sauvegardez et restaurez votre base de données (SQLite). Faites une sauvegarde avant chaque mise à jour.</p>
      </HowToCard>

      <HowToCard title="9. Boutique Admin" icon={Store}>
        <p className="font-semibold mt-3">Apparence</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li><strong>Général</strong> : logo upload, nom, top bar, contact, <strong>boutique fermée</strong> (ON/OFF + message).</li>
          <li><strong>Couleurs</strong> : principale, foncée, fond header/top bar/footer.</li>
          <li><strong>Hero</strong> : titre, sous-titre, CTA, image de fond.</li>
          <li><strong>Confiance</strong> : 4 badges cliquables vers pages confiance.</li>
          <li><strong>Menu</strong> : liens drag-and-drop + œil pour masquer.</li>
          <li><strong>Footer</strong> : 3 colonnes éditables avec liens drag-and-drop.</li>
          <li><strong>Pages confiance</strong> : Paiement, Livraison, Retours (éditeur WYSIWYG).</li>
          <li><strong>Horaires/CGV</strong> : master switch + éditeur par jour + CGV/Mentions légales WYSIWYG + Google Analytics (GA4).</li>
        </ul>
        <p className="font-semibold mt-3">Livraison</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li><strong>Modes</strong> : Standard, Suivi, Point relais, Retrait — avec prix + délai.</li>
          <li><strong>Tranches de poids</strong> : prix calculé selon le poids du panier.</li>
          <li><strong>Transporteur</strong> : association pour le suivi de colis.</li>
          <li><strong>Livraison offerte</strong> : ON/OFF + seuil.</li>
          <li><strong>Point relais</strong> : carte Leaflet + points relais (Mondial Relay).</li>
          <li><strong>Config API</strong> : Stripe, PayPal, Mondial Relay (clés API).</li>
        </ul>
        <p className="font-semibold mt-3">Catégories</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Catégories + sous-catégories (arborescence avec parentId).</li>
          <li>Image de fond, couleur, opacité, emoji, ordre, collapse.</li>
          <li>Filtres personnalisés par catégorie (Taille, Couleur, État, Marque).</li>
          <li>Si pas d'emoji → affiche le nombre de produits.</li>
        </ul>
        <p className="font-semibold mt-3">Paiements</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Démo (simulation), Stripe (CB), PayPal, Manuel (virement/chèque).</li>
          <li>Activez/désactivez chaque mode.</li>
        </ul>
      </HowToCard>

      <HowToCard title="10. Modules principaux" icon={Package}>
        <p className="font-semibold">Stock</p>
        <p className="ml-2 text-muted-foreground">Articles avec SKU, titre, marque, catégorie, photos, prix, poids. Statuts : À photographier → Publié → Vendu.</p>
        <p className="font-semibold mt-2">Ventes</p>
        <p className="ml-2 text-muted-foreground">Multi-plateformes avec calcul de marge. Factures PDF.</p>
        <p className="font-semibold mt-2">Colis</p>
        <p className="ml-2 text-muted-foreground">Vue Kanban : À préparer → En transit → Livré.</p>
        <p className="font-semibold mt-2">Vinted Deals</p>
        <p className="ml-2 text-muted-foreground">Recherche de deals + alertes cron.</p>
        <p className="font-semibold mt-2">Product Trend</p>
        <p className="ml-2 text-muted-foreground">Tendances multi-marketplaces + snapshots + export CSV.</p>
        <p className="font-semibold mt-2">Shooting Photo</p>
        <p className="ml-2 text-muted-foreground">Sessions photos + attachement au stock.</p>
      </HowToCard>

      <HowToCard title="11. Déploiement serveur" icon={Upload}>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li><strong>PC</strong> : <code>push.bat "description"</code></li>
          <li><strong>Serveur</strong> : <code>./pull.sh</code> (backup DB + git pull + build + restart + purge cache nginx)</li>
          <li>Build avec <strong>webpack</strong> (pas Turbopack).</li>
          <li>Protégez le <code>.env</code> (<code>attrib +r .env</code> sur Windows).</li>
        </ul>
      </HowToCard>

      <HowToCard title="12. Sitemap & SEO" icon={ExternalLink}>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Sitemap auto-généré à <code>/sitemap.xml</code>.</li>
          <li>Mise à jour auto via <code>revalidatePath</code>.</li>
          <li>Google Analytics : ID GA4 dans <em>Apparence → Horaires/CGV</em>.</li>
        </ul>
      </HowToCard>
    </div>
  )
}

function HowToCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </CardTitle>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CardHeader>
      {open && (
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
