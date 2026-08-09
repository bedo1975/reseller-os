'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShoppingBag, Package, Users, Mail, Palette, Truck, Layers,
  Loader2, Trash2, Edit, Eye, Send, Check, X, Plus, Save, RefreshCw, Upload,
  ChevronRight, ChevronDown, Clock, Euro, FileText, Image as ImageIcon, Store, Shield, BarChart3, Filter, MapPin, Search,
  TicketPercent, Share2, MailOpen, BellRing, Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/hooks/use-settings'
import { clearBoutiqueSettingsCache } from '@/hooks/use-boutique-settings'
import { LinkEditor } from '@/components/boutique/link-editor'
import { HoursEditor } from '@/components/boutique/hours-editor'
import { HtmlEditor } from '@/components/ui/html-editor'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import { formatEUR, formatDate } from '@/lib/constants'

type Tab = 'orders' | 'clients' | 'messages' | 'appearance' | 'shipping' | 'payments' | 'categories' | 'coupons' | 'share' | 'newsletter' | 'stock-alerts'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'orders', label: 'Commandes', icon: Package },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'messages', label: 'Messagerie', icon: Mail },
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'shipping', label: 'Livraison', icon: Truck },
  { id: 'payments', label: 'Paiements', icon: Euro },
  { id: 'categories', label: 'Catégories', icon: Layers },
  { id: 'coupons', label: 'Coupons', icon: TicketPercent },
  { id: 'share', label: 'Partage', icon: Share2 },
  { id: 'newsletter', label: 'Newsletter', icon: MailOpen },
  { id: 'stock-alerts', label: 'Alertes stock', icon: BellRing },
]

export function BoutiqueAdminModule() {
  const { can } = usePermissions()
  const [tab, setTab] = useState<Tab>('orders')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Boutique Admin
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez votre boutique en ligne : commandes, clients, messagerie, apparence et livraison
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          // Check if user has view permission on this sub-tab
          const permKey = `boutique-admin:${t.id}`
          if (!can(permKey, 'view')) return null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                active
                  ? 'border-foreground/30 bg-card shadow-sm text-foreground'
                  : 'border-border/60 hover:border-foreground/20 bg-card/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'clients' && <ClientsTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'shipping' && <ShippingTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'coupons' && <CouponsTab />}
      {tab === 'share' && <ShareTab />}
      {tab === 'newsletter' && <NewsletterTab />}
      {tab === 'stock-alerts' && <StockAlertsTab />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 1 — COMMANDES
// ═══════════════════════════════════════════════════════════════════════════

interface OrderItem {
  sku: string
  brand: string
  category: string
  size?: string | null
  color?: string | null
  price: number
  qty: number
}

interface Order {
  id: string
  orderId: string
  clientId: string | null
  clientName: string
  clientEmail: string
  items: OrderItem[]
  shippingMethod: string
  shippingCost: number
  paymentMethod: string | null
  subtotal: number
  total: number
  couponCode: string | null
  discountAmount: number
  status: string
  invoiceNumbers: string[]
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  { value: 'paid', label: 'Payée', color: 'bg-blue-100 text-blue-700' },
  { value: 'preparation', label: 'En préparation', color: 'bg-purple-100 text-purple-700' },
  { value: 'shipped', label: 'Expédiée', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'delivered', label: 'Livrée', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Annulée', color: 'bg-red-100 text-red-700' },
]

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements', chaussures: 'Chaussures', accessoires: 'Accessoires',
  luxe: 'Luxe', maison: 'Maison',
}

function OrdersTab() {
  const { getByType } = useSettings()
  const { can } = usePermissions()
  const carriers = getByType('carrier')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editTracking, setEditTracking] = useState('')
  const [editCarrier, setEditCarrier] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/boutique/admin/orders')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)

  const openEdit = (order: Order) => {
    setEditingOrder(order)
    setEditStatus(order.status)
    setEditTracking('')
    setEditCarrier('')
  }

  const saveEdit = async () => {
    if (!editingOrder) return
    setSaving(true)
    try {
      const body: any = { status: editStatus }
      if (editTracking.trim()) {
        body.trackingNumber = editTracking.trim()
        body.carrier = editCarrier
      }
      const res = await fetch(`/api/boutique/admin/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast.error('Erreur')
        return
      }
      toast.success('Commande mise à jour')
      setEditingOrder(null)
      fetchOrders()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const deleteOrder = async (id: string) => {
    if (!confirm('Supprimer cette commande ? Les articles seront remis en stock (PUBLIÉ).')) return
    try {
      const res = await fetch(`/api/boutique/admin/orders/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Commande supprimée, articles remis en stock')
      fetchOrders()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground">Filtrer par statut :</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes ({orders.length})</SelectItem>
            {STATUS_OPTIONS.map(s => {
              const count = orders.filter(o => o.status === s.value).length
              return <SelectItem key={s.value} value={s.value}>{s.label} ({count})</SelectItem>
            })}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune commande pour ce filtre</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const status = STATUS_OPTIONS.find(s => s.value === order.status) || STATUS_OPTIONS[0]
            return (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono font-semibold bg-muted px-2 py-0.5 rounded">{order.orderId}</code>
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                      <p className="text-sm font-medium">{order.clientName}</p>
                      <p className="text-xs text-muted-foreground">{order.clientEmail}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatEUR(order.total)}</p>
                      <p className="text-xs text-muted-foreground">{order.items.length} article(s)</p>
                      {order.paymentMethod && <p className="text-xs text-muted-foreground">{order.paymentMethod}</p>}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1 mb-3 pb-3 border-b">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{item.brand} · {CATEGORY_LABELS[item.category] || item.category}{item.size && ` · ${item.size}`}{item.qty > 1 && ` ×${item.qty}`}</span>
                        <span className="font-medium">{(item.price * item.qty).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals (with optional coupon) */}
                  <div className="space-y-1 mb-3 pb-3 border-b text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Sous-total</span>
                      <span>{formatEUR(order.subtotal)}</span>
                    </div>
                    {order.couponCode && order.discountAmount > 0 && (
                      <div className="flex justify-between text-green-700">
                        <span className="flex items-center gap-1">
                          <TicketPercent className="h-3 w-3" /> Coupon <code className="font-mono">{order.couponCode}</code>
                        </span>
                        <span>−{order.discountAmount.toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Livraison ({order.shippingMethod})</span>
                      <span>{order.shippingCost === 0 ? 'Gratuite' : formatEUR(order.shippingCost)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1">
                      <span>Total</span>
                      <span>{formatEUR(order.total)}</span>
                    </div>
                  </div>

                  {/* Invoices */}
                  {order.invoiceNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {order.invoiceNumbers.map(n => (
                        <span key={n} className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{n}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(order)}>
                      <Edit className="h-3.5 w-3.5 mr-1" /> Modifier statut
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => window.open(`/api/boutique/admin/orders/${order.id}/preparation`, '_blank')}
                    >
                      <Package className="h-3.5 w-3.5 mr-1" /> Bon de préparation
                    </Button>
                    {can('boutique-admin', 'delete') && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteOrder(order.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(o) => !o && setEditingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la commande {editingOrder?.orderId}</DialogTitle>
            <DialogDescription>Changez le statut et ajoutez un numéro de suivi si expédiée</DialogDescription>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editStatus === 'shipped' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Numéro de suivi</Label>
                    <Input value={editTracking} onChange={e => setEditTracking(e.target.value)} placeholder="Ex: 1Z999AA10123456784" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Transporteur</Label>
                    <Select value={editCarrier} onValueChange={setEditCarrier}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {carriers.map(c => (
                          <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Annuler</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 2 — CLIENTS
// ═══════════════════════════════════════════════════════════════════════════

interface ClientSummary {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  city: string | null
  ordersCount: number
  messagesCount: number
  lastVisitAt: string | null
  createdAt: string
}

interface ClientDetail extends ClientSummary {
  address: string | null
  postalCode: string | null
  country: string
  newsletter: boolean
  orders: any[]
  messages: any[]
}

function ClientsTab() {
  const { can } = usePermissions()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/boutique/admin/clients')
      const data = await res.json()
      setClients(data.clients || [])
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  const openClient = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/boutique/admin/clients/${id}`)
      const data = await res.json()
      setSelectedClient(data)
    } catch {
      toast.error('Erreur')
    } finally {
      setDetailLoading(false)
    }
  }

  const deleteClient = async (id: string) => {
    if (!confirm('Supprimer ce client ? Ses commandes seront conservées mais détachées.')) return
    try {
      await fetch(`/api/boutique/admin/clients/${id}`, { method: 'DELETE' })
      toast.success('Client supprimé')
      setSelectedClient(null)
      fetchClients()
    } catch {
      toast.error('Erreur')
    }
  }

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
  }

  return (
    <div className="space-y-4">
      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucun client inscrit pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {clients.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" >
              <CardContent className="p-4 flex items-center gap-4" onClick={() => openClient(c.id)}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {c.firstName[0]}{c.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}{c.phone && ` · ${c.phone}`}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">{c.ordersCount} commande(s)</Badge>
                    <Badge variant="secondary" className="text-[10px]">{c.messagesCount} message(s)</Badge>
                    {c.lastVisitAt && <span className="text-[10px] text-muted-foreground">Vu le {formatDate(c.lastVisitAt)}</span>}
                  </div>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client detail dialog */}
      <Dialog open={!!selectedClient || detailLoading} onOpenChange={(o) => !o && setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail client</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
          ) : selectedClient ? (
            <>
              <div className="space-y-1 -mt-2">
                <DialogTitle className="text-lg">{selectedClient.firstName} {selectedClient.lastName}</DialogTitle>
                <DialogDescription>{selectedClient.email}</DialogDescription>
              </div>
              <div className="space-y-4 py-2">
                {/* Coordonnées */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground text-xs">Téléphone</span><p className="font-medium">{selectedClient.phone || '—'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Ville</span><p className="font-medium">{selectedClient.city || '—'}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Adresse</span><p className="font-medium">{selectedClient.address || '—'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Inscrit le</span><p className="font-medium">{formatDate(selectedClient.createdAt)}</p></div>
                  <div><span className="text-muted-foreground text-xs">Newsletter</span><p className="font-medium">{selectedClient.newsletter ? 'Oui' : 'Non'}</p></div>
                </div>

                {/* Commandes */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Package className="h-4 w-4" /> Commandes ({selectedClient.orders.length})</h4>
                  {selectedClient.orders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune commande</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedClient.orders.map((o: any) => {
                        const st = STATUS_OPTIONS.find(s => s.value === o.status) || STATUS_OPTIONS[0]
                        return (
                          <div key={o.id} className="flex justify-between items-center text-xs p-2 border rounded">
                            <div>
                              <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">{o.orderId}</code>
                              <span className="ml-2">{formatDate(o.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={st.color + ' text-[9px]'}>{st.label}</Badge>
                              <span className="font-bold">{formatEUR(o.total)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Mail className="h-4 w-4" /> Messages ({selectedClient.messages.length})</h4>
                  {selectedClient.messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun message</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedClient.messages.map((m: any) => (
                        <div key={m.id} className={cn('text-xs p-2 rounded', m.fromClient ? 'bg-blue-50 text-blue-900' : 'bg-muted')}>
                          <span className="font-semibold">{m.fromClient ? 'Client' : 'Admin'}</span>
                          {m.subject && <span className="text-muted-foreground"> · {m.subject}</span>}
                          <p className="mt-0.5">{m.body.slice(0, 100)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                {can('boutique-admin:clients', 'delete') && (
                  <Button variant="destructive" size="sm" onClick={() => deleteClient(selectedClient.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer le client
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedClient(null)}>Fermer</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 3 — MESSAGERIE
// ═══════════════════════════════════════════════════════════════════════════

interface Conversation {
  clientId: string
  clientName: string
  clientEmail: string
  lastMessage: string
  lastDate: string
  unreadCount: number
}

interface Message {
  id: string
  fromClient: boolean
  subject: string
  body: string
  read: boolean
  createdAt: string
}

function MessagesTab() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [replySubject, setReplySubject] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/boutique/admin/messages')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const openConversation = async (clientId: string) => {
    setSelectedClientId(clientId)
    try {
      const res = await fetch(`/api/boutique/admin/messages?clientId=${clientId}`)
      const data = await res.json()
      setMessages(data.messages || [])
      // Refresh conversations to mark as read
      fetchConversations()
    } catch {
      toast.error('Erreur')
    }
  }

  const sendReply = async () => {
    if (!selectedClientId || !replySubject.trim() || !replyBody.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/boutique/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId, subject: replySubject, body: replyBody }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Message envoyé')
      setReplySubject('')
      setReplyBody('')
      openConversation(selectedClientId)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  const deleteConversation = async (clientId: string) => {
    if (!confirm('Supprimer toute cette conversation ? Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/boutique/admin/messages/${clientId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Conversation supprimée')
      if (selectedClientId === clientId) {
        setSelectedClientId(null)
        setMessages([])
      }
      fetchConversations()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  if (loading) {
    return <Skeleton className="h-64" />
  }

  const selectedConv = conversations.find(c => c.clientId === selectedClientId)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Conversation list */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-semibold mb-2">Boîte de réception</h3>
        {conversations.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucun message</CardContent></Card>
        ) : (
          conversations.map(c => (
            <Card
              key={c.clientId}
              className={cn('cursor-pointer hover:shadow-md transition-shadow group relative', selectedClientId === c.clientId && 'border-primary')}
            >
              <CardContent className="p-3" onClick={() => openConversation(c.clientId)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(c.lastDate)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.unreadCount > 0 && (
                      <Badge className="bg-red-600 text-white text-[10px]">{c.unreadCount}</Badge>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(c.clientId) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-red-600 transition-opacity"
                      title="Supprimer la conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Conversation detail */}
      <div className="lg:col-span-2">
        {selectedClientId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedConv?.clientName || 'Conversation'}
              </CardTitle>
              <CardDescription>{selectedConv?.clientEmail}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Messages */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {messages.map(m => (
                  <div key={m.id} className={cn('flex', m.fromClient ? 'justify-start' : 'justify-end')}>
                    <div className={cn('max-w-[80%] rounded-lg p-2.5 text-sm', m.fromClient ? 'bg-muted' : 'bg-primary text-primary-foreground')}>
                      {m.subject && <p className="text-xs font-semibold mb-0.5 opacity-80">{m.subject}</p>}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={cn('text-[10px] mt-1', m.fromClient ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
                        {new Date(m.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply */}
              <div className="border-t pt-3 space-y-2">
                <Input value={replySubject} onChange={e => setReplySubject(e.target.value)} placeholder="Sujet de la réponse" className="h-9" />
                <Textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Votre réponse..." rows={2} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={sendReply} disabled={sending || !replySubject.trim() || !replyBody.trim()}>
                    {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Envoyer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Sélectionnez une conversation</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 4 — APPARENCE (couleurs, hero, CGV, horaires)
// ═══════════════════════════════════════════════════════════════════════════

interface BoutiqueSettingsData {
  heroEyebrow: string
  heroTitle: string
  heroSubtitle: string
  heroCtaLabel: string
  heroCtaLink: string
  heroImage: string | null
  topBarText: string
  footerAbout: string
  footerEmail: string
  footerPhone: string | null
  logoText: string
  logoSubtitle: string
  logoImage: string | null
  primaryColor: string
  primaryDarkColor: string
  headerBgColor: string
  topbarBgColor: string
  footerBgColor: string
  freeShippingEnabled: boolean
  freeShippingThreshold: number
  boutiqueClosed: boolean
  boutiqueClosedMessage: string
  emailDesign: string
  hoursJson: string
  hoursVisible: boolean
  cgvText: string | null
  legalText: string | null
  trustBadge1Icon: string
  trustBadge1Title: string
  trustBadge1Desc: string
  trustBadge2Icon: string
  trustBadge2Title: string
  trustBadge2Desc: string
  trustBadge3Icon: string
  trustBadge3Title: string
  trustBadge3Desc: string
  trustBadge4Icon: string
  trustBadge4Title: string
  trustBadge4Desc: string
  newProductsTitle: string
  newProductsSubtitle: string
  contactTitle: string
  contactSubtitle: string
  contactButtonText: string
  categoriesTitle: string
  categoriesSubtitle: string
  footerLinksJson: string
  footerBoutiqueTitle: string
  footerInfosTitle: string
  footerContactTitle: string
  footerBoutiqueLinksJson: string
  footerInfosLinksJson: string
  navMenuJson: string
  trustPagePaymentTitle: string
  trustPagePaymentContent: string | null
  trustPageShippingTitle: string
  trustPageShippingContent: string | null
  trustPageReturnsTitle: string
  trustPageReturnsContent: string | null
  gradePageTitle: string
  gradePageContent: string | null
  gaTagId: string | null
  seoTitle: string | null
  seoDescription: string | null
  chronopostAccountNumber: string | null
  chronopostApiKey: string | null
  gdprEnabled: boolean
  gdprBannerTitle: string
  gdprBannerMessage: string
  gdprPrivacyPolicyUrl: string | null
  gdprCookiesJson: string
  stripePublicKey: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  paypalClientId: string | null
  paypalSecret: string | null
  mondialRelayEnseigne: string | null
  mondialRelayApiKey: string | null
  preparationSlipSubtitle: string
  invoiceFooterText: string | null
}

function AppearanceTab() {
  const [form, setForm] = useState<BoutiqueSettingsData | null>(null)
  const [saving, setSaving] = useState(false)
  const [subTab, setSubTab] = useState<'general' | 'colors' | 'hero' | 'badges' | 'sections' | 'menu' | 'footer' | 'pages' | 'misc'>('general')

  useEffect(() => {
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => {
        // Initialize default links if empty so they appear in the editor
        const withDefaults = { ...data }
        if (!withDefaults.navMenuJson || withDefaults.navMenuJson === '[]') {
          withDefaults.navMenuJson = JSON.stringify([
            { label: 'Vêtements', url: '/categorie/vetements', visible: true, order: 1 },
            { label: 'Chaussures', url: '/categorie/chaussures', visible: true, order: 2 },
            { label: 'Accessoires', url: '/categorie/accessoires', visible: true, order: 3 },
          ])
        }
        if (!withDefaults.footerInfosLinksJson || withDefaults.footerInfosLinksJson === '[]') {
          withDefaults.footerInfosLinksJson = JSON.stringify([
            { label: 'CGV', url: '/cgv', visible: true },
            { label: 'Mon panier', url: '/panier', visible: true },
            { label: 'Contact', url: '/contact', visible: true },
            { label: 'Espace gestion', url: '/', visible: true },
          ])
        }
        // Initialize horaires with default days so they appear in the editor AND in the footer
        if (!withDefaults.hoursJson || withDefaults.hoursJson === '[]') {
          withDefaults.hoursJson = JSON.stringify([
            { day: 'Lundi', hours: '9h - 18h', closed: false, visible: true },
            { day: 'Mardi', hours: '9h - 18h', closed: false, visible: true },
            { day: 'Mercredi', hours: '9h - 18h', closed: false, visible: true },
            { day: 'Jeudi', hours: '9h - 18h', closed: false, visible: true },
            { day: 'Vendredi', hours: '9h - 18h', closed: false, visible: true },
            { day: 'Samedi', hours: '10h - 17h', closed: false, visible: true },
            { day: 'Dimanche', hours: '', closed: true, visible: false },
          ])
        }
        setForm(withDefaults)
      })
      .catch(() => {})
  }, [])

  const set = (k: keyof BoutiqueSettingsData, v: any) => {
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
      if (!res.ok) { toast.error('Erreur'); return }
      clearBoutiqueSettingsCache()
      toast.success('Apparence sauvegardée')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <Skeleton className="h-64" />

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'general' as const, label: '⚙️ Général' },
          { id: 'colors' as const, label: '🎨 Couleurs' },
          { id: 'hero' as const, label: '🖼️ Hero' },
          { id: 'badges' as const, label: '✅ Confiance' },
          { id: 'sections' as const, label: '📋 Sections' },
          { id: 'menu' as const, label: '🧭 Menu' },
          { id: 'footer' as const, label: '📄 Footer' },
          { id: 'pages' as const, label: '📑 Pages confiance' },
          { id: 'misc' as const, label: '🕐 Horaires/CGV' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
              subTab === t.id
                ? 'border-foreground/30 bg-card shadow-sm'
                : 'border-border/60 hover:border-foreground/20 text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Général — logo, top bar, about, seuil livraison */}
      {subTab === 'general' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> Logo & Marque</CardTitle>
          <CardDescription className="text-xs">Logo affiché dans l'en-tête et le footer de la boutique</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Image du logo (optionnel)</Label>
            <div className="flex gap-2 items-start">
              <div className="w-20 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/40 shrink-0">
                {form.logoImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoImage} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Store className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input value={form.logoImage || ''} onChange={e => set('logoImage', e.target.value)} placeholder="/api/uploads/-logo/..." className="text-xs font-mono" />
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        const fd = new FormData()
                        fd.append('file', f)
                        const res = await fetch('/api/boutique/admin/logo-upload', { method: 'POST', body: fd })
                        const data = await res.json()
                        if (res.ok && data.path) {
                          set('logoImage', data.path)
                          toast.success('Logo uploadé')
                        } else {
                          toast.error(data.error || 'Erreur upload')
                        }
                      }}
                    />
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-muted cursor-pointer">
                      <Upload className="h-3.5 w-3.5" /> Uploader
                    </span>
                  </label>
                  {form.logoImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => set('logoImage', null)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Si aucun logo, la 1ère lettre du nom est utilisée comme avatar. Format conseillé : PNG transparent, 200×200px max.</p>
              </div>
            </div>
          </div>

          {/* Text fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom de la boutique (texte à côté du logo)</Label>
              <Input value={form.logoText || ''} onChange={e => set('logoText', e.target.value)} placeholder="DBoxPro" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sous-titre (sous le nom)</Label>
              <Input value={form.logoSubtitle || ''} onChange={e => set('logoSubtitle', e.target.value)} placeholder="Boutique" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Barre supérieure (top bar)</CardTitle>
          <CardDescription className="text-xs">Bandeau fin affiché tout en haut du site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label className="text-xs">Texte du top bar</Label>
          <Input value={form.topBarText || ''} onChange={e => set('topBarText', e.target.value)} placeholder="Livraison offerte dès 50€ d'achat · Paiement sécurisé" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">À propos (footer, 1ère colonne)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label className="text-xs">Texte de présentation</Label>
          <Textarea value={form.footerAbout || ''} onChange={e => set('footerAbout', e.target.value)} rows={3} placeholder="Votre boutique de vêtements et accessoires seconde main..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact (footer, colonne Contact)</CardTitle>
          <CardDescription className="text-xs">Email et téléphone affichés dans la colonne Contact du footer</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Email de contact</Label>
            <Input type="email" value={form.footerEmail || ''} onChange={e => set('footerEmail', e.target.value)} placeholder="contact@maboutique.fr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Téléphone (optionnel)</Label>
            <Input value={form.footerPhone || ''} onChange={e => set('footerPhone', e.target.value)} placeholder="06 12 34 56 78" />
          </div>
        </CardContent>
      </Card>

      {/* Boutique fermée */}
      <Card className={form.boutiqueClosed ? 'border-red-300 bg-red-50/40 dark:bg-red-950/20' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Boutique fermée
            {form.boutiqueClosed
              ? <Badge className="bg-red-600 hover:bg-red-600">Fermée</Badge>
              : <Badge variant="secondary">Ouverte</Badge>
            }
          </CardTitle>
          <CardDescription className="text-xs">
            Activez cette option pour suspendre temporairement les commandes. Les boutons d'achat et de checkout seront masqués sur la boutique, et le message sera affiché aux clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!form.boutiqueClosed}
              onCheckedChange={(v) => set('boutiqueClosed', v)}
            />
            <Label className="text-sm cursor-pointer" onClick={() => set('boutiqueClosed', !form.boutiqueClosed)}>
              {form.boutiqueClosed ? 'Boutique fermée — les commandes sont désactivées' : 'Boutique ouverte — les commandes sont activées'}
            </Label>
          </div>
          {form.boutiqueClosed && (
            <div className="space-y-1.5">
              <Label className="text-xs">Message affiché aux clients</Label>
              <Textarea
                value={form.boutiqueClosedMessage || ''}
                onChange={e => set('boutiqueClosedMessage', e.target.value)}
                rows={3}
                placeholder="La boutique est temporairement fermée. Revenez bientôt !"
              />
              <p className="text-[11px] text-muted-foreground">Ce message sera affiché sur les pages produit, panier et checkout à la place des boutons d'achat.</p>
            </div>
          )}
        </CardContent>
      </Card>

      </>
      )}

      {/* Couleurs */}
      {subTab === 'colors' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Couleurs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: 'primaryColor' as const, label: 'Couleur principale', hint: '007bff' },
            { key: 'primaryDarkColor' as const, label: 'Couleur foncée (hover)', hint: '0056b3' },
            { key: 'headerBgColor' as const, label: 'Fond header', hint: 'ffffff' },
            { key: 'topbarBgColor' as const, label: 'Fond top bar', hint: '0a3d62' },
            { key: 'footerBgColor' as const, label: 'Fond footer', hint: '0a3d62' },
          ].map(c => (
            <div key={c.key} className="space-y-1.5">
              <Label className="text-xs">{c.label}</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={'#' + form[c.key]}
                  onChange={e => set(c.key, e.target.value.replace('#', ''))}
                  className="w-10 h-9 rounded border cursor-pointer shrink-0"
                  title="Sélecteur de couleur"
                />
                <Input
                  value={'#' + form[c.key]}
                  onChange={e => set(c.key, e.target.value.replace('#', ''))}
                  className="font-mono text-xs flex-1"
                  placeholder={'#' + c.hint}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* Hero */}
      {subTab === 'hero' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Hero (page d'accueil)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Petit label (au-dessus du titre)</Label>
            <Input value={form.heroEyebrow} onChange={e => set('heroEyebrow', e.target.value)} placeholder="Seconde main premium (laisser vide pour masquer)" />
            <p className="text-[10px] text-muted-foreground">Affiché en petit au-dessus du titre principal. Laisser vide pour ne pas l'afficher.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Titre</Label>
            <Input value={form.heroTitle} onChange={e => set('heroTitle', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-titre</Label>
            <Textarea value={form.heroSubtitle} onChange={e => set('heroSubtitle', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bouton CTA - texte</Label>
              <Input value={form.heroCtaLabel} onChange={e => set('heroCtaLabel', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bouton CTA - lien</Label>
              <Input value={form.heroCtaLink} onChange={e => set('heroCtaLink', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Image de fond</Label>
            <div className="flex gap-2">
              <Input value={form.heroImage || ''} onChange={e => set('heroImage', e.target.value)} placeholder="/api/uploads/-hero/..." className="flex-1" />
              <label className="cursor-pointer shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const fd = new FormData()
                    fd.append('file', f)
                    const res = await fetch('/api/boutique/admin/hero-upload', { method: 'POST', body: fd })
                    const data = await res.json()
                    if (res.ok && data.path) {
                      set('heroImage', data.path)
                      toast.success('Image uploadée')
                    } else {
                      toast.error(data.error || 'Erreur upload')
                    }
                  }}
                />
                <span className="inline-flex items-center gap-1 px-3 py-2 border rounded-md text-xs font-medium hover:bg-muted cursor-pointer whitespace-nowrap">
                  <Upload className="h-3.5 w-3.5" /> Upload
                </span>
              </label>
            </div>
            {form.heroImage && (
              <div className="mt-2 relative rounded-lg overflow-hidden border aspect-video bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.heroImage} alt="Hero" className="w-full h-full object-cover" />
                <button
                  onClick={() => set('heroImage', null)}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full"
                  title="Supprimer l'image"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Trust badges (4 cartes sous le hero) */}
      {subTab === 'badges' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cartes de confiance (sous le hero)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(n => {
            const iconKey = `trustBadge${n}Icon` as keyof BoutiqueSettingsData
            const titleKey = `trustBadge${n}Title` as keyof BoutiqueSettingsData
            const descKey = `trustBadge${n}Desc` as keyof BoutiqueSettingsData
            return (
              <div key={n} className="grid grid-cols-3 gap-3 pb-3 border-b last:border-0">
                <div className="space-y-1.5">
                  <Label className="text-xs">Badge {n} - Icône</Label>
                  <Input value={form[iconKey] as string || ''} onChange={e => set(iconKey, e.target.value)} placeholder="truck" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Badge {n} - Titre</Label>
                  <Input value={form[titleKey] as string || ''} onChange={e => set(titleKey, e.target.value)} placeholder="Livraison rapide" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Badge {n} - Description</Label>
                  <Input value={form[descKey] as string || ''} onChange={e => set(descKey, e.target.value)} placeholder="Expédition sous 48h" />
                </div>
              </div>
            )
          })}
          <p className="text-[11px] text-muted-foreground">Icônes disponibles : truck, shield, refresh, headphones, package, star, check, clock</p>
        </CardContent>
      </Card>
      )}

      {/* Sections page d'accueil */}
      {subTab === 'sections' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sections page d'accueil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre section "Nouveautés"</Label>
            <Input value={form.newProductsTitle || ''} onChange={e => set('newProductsTitle', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-titre section "Nouveautés"</Label>
            <Input value={form.newProductsSubtitle || ''} onChange={e => set('newProductsSubtitle', e.target.value)} />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Section contact */}
      {subTab === 'sections' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Section contact (bas de page)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre</Label>
            <Input value={form.contactTitle || ''} onChange={e => set('contactTitle', e.target.value)} placeholder="Une question ?" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-titre</Label>
            <Input value={form.contactSubtitle || ''} onChange={e => set('contactSubtitle', e.target.value)} placeholder="Notre équipe est à votre écoute" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Texte bouton</Label>
            <Input value={form.contactButtonText || ''} onChange={e => set('contactButtonText', e.target.value)} placeholder="Nous contacter" />
          </div>
          <p className="text-[11px] text-muted-foreground">Le bouton ouvre un formulaire de contact qui envoie vers la messagerie interne.</p>
        </CardContent>
      </Card>
      )}

      {/* Section catégories */}
      {subTab === 'sections' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Section "Explorer par catégorie"</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre</Label>
            <Input value={form.categoriesTitle || ''} onChange={e => set('categoriesTitle', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-titre</Label>
            <Input value={form.categoriesSubtitle || ''} onChange={e => set('categoriesSubtitle', e.target.value)} />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Menu de navigation personnalisable */}
      {subTab === 'menu' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Menu de navigation</CardTitle>
          <CardDescription className="text-xs">Ajoutez des liens au menu principal. Si vide, les catégories sont utilisées par défaut.</CardDescription>
        </CardHeader>
        <CardContent>
          <LinkEditor
            value={form.navMenuJson || '[]'}
            onChange={(json) => set('navMenuJson', json)}
            placeholder="/categorie/vetements"
            showOrder
          />
          <p className="text-[11px] text-muted-foreground mt-2">Si vide, les catégories sont utilisées par défaut. Cliquez sur l'œil pour masquer/afficher un lien.</p>
        </CardContent>
      </Card>
      )}

      {/* Footer complet - 3 colonnes éditables */}
      {subTab === 'footer' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> Logo & texte du footer</CardTitle>
          <CardDescription className="text-xs">Logo affiché en haut de la 1ère colonne du footer (même logo que l'en-tête par défaut)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo preview + upload */}
          <div className="flex gap-3 items-start">
            <div className="w-20 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/40 shrink-0">
              {form.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoImage} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Store className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Input value={form.logoImage || ''} onChange={e => set('logoImage', e.target.value)} placeholder="/api/uploads/-logo/..." className="text-xs font-mono" />
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const fd = new FormData()
                      fd.append('file', f)
                      const res = await fetch('/api/boutique/admin/logo-upload', { method: 'POST', body: fd })
                      const data = await res.json()
                      if (res.ok && data.path) {
                        set('logoImage', data.path)
                        toast.success('Logo uploadé')
                      } else {
                        toast.error(data.error || 'Erreur upload')
                      }
                    }}
                  />
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-muted cursor-pointer">
                    <Upload className="h-3.5 w-3.5" /> Uploader
                  </span>
                </label>
                {form.logoImage && (
                  <Button type="button" variant="outline" size="sm" onClick={() => set('logoImage', null)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Ce logo est partagé entre l'en-tête et le footer.</p>
            </div>
          </div>
          {/* Logo text fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom de la boutique</Label>
              <Input value={form.logoText || ''} onChange={e => set('logoText', e.target.value)} placeholder="DBoxPro" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sous-titre</Label>
              <Input value={form.logoSubtitle || ''} onChange={e => set('logoSubtitle', e.target.value)} placeholder="Boutique" />
            </div>
          </div>
          {/* Footer about text */}
          <div className="space-y-1.5">
            <Label className="text-xs">Texte de présentation (sous le logo)</Label>
            <Textarea value={form.footerAbout || ''} onChange={e => set('footerAbout', e.target.value)} rows={3} placeholder="Votre boutique de vêtements et accessoires seconde main..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Footer — 3 colonnes éditables</CardTitle>
          <CardDescription className="text-xs">Personnalisez les titres et liens de chaque colonne du footer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Colonne Boutique */}
          <div className="space-y-2 pb-3 border-b">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Colonne 1 — Titre</Label>
              <Input value={form.footerBoutiqueTitle || ''} onChange={e => set('footerBoutiqueTitle', e.target.value)} placeholder="Boutique" />
            </div>
            <Label className="text-xs">Liens supplémentaires</Label>
            <LinkEditor
              value={form.footerBoutiqueLinksJson || '[]'}
              onChange={(json) => set('footerBoutiqueLinksJson', json)}
              placeholder="/"
              showOrder
            />
          </div>
          {/* Colonne Informations */}
          <div className="space-y-2 pb-3 border-b">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Colonne 2 — Titre</Label>
              <Input value={form.footerInfosTitle || ''} onChange={e => set('footerInfosTitle', e.target.value)} placeholder="Informations" />
            </div>
            <Label className="text-xs">Liens</Label>
            <LinkEditor
              value={form.footerInfosLinksJson || '[]'}
              onChange={(json) => set('footerInfosLinksJson', json)}
              placeholder="/cgv"
              showOrder
            />
            <p className="text-[11px] text-muted-foreground">Si vide, liens par défaut (CGV, Mon panier, Contact, Espace gestion).</p>
          </div>
          {/* Colonne Contact */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Colonne 3 — Titre</Label>
              <Input value={form.footerContactTitle || ''} onChange={e => set('footerContactTitle', e.target.value)} placeholder="Contact" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Email de contact</Label>
                <Input type="email" value={form.footerEmail || ''} onChange={e => set('footerEmail', e.target.value)} placeholder="contact@maboutique.fr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone (optionnel)</Label>
                <Input value={form.footerPhone || ''} onChange={e => set('footerPhone', e.target.value)} placeholder="06 12 34 56 78" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Les horaires sont éditables dans l'onglet « Horaires/CGV ».</p>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Pages confiance — Paiement sécurisé, Livraison rapide, Retours 14 jours */}
      {subTab === 'pages' && (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Page « Paiement sécurisé »</CardTitle>
          <CardDescription className="text-xs">Page dédiée accessible depuis les badges de confiance. URL : //paiement-securise</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre de la page</Label>
            <Input value={form.trustPagePaymentTitle || ''} onChange={e => set('trustPagePaymentTitle', e.target.value)} placeholder="Paiement sécurisé" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contenu (HTML autorisé)</Label>
            <Textarea
              value={form.trustPagePaymentContent || ''}
              onChange={e => set('trustPagePaymentContent', e.target.value)}
              rows={8}
              placeholder="<h2>Paiement 100% sécurisé</h2><p>Nous utilisons Stripe et PayPal pour protéger vos transactions...</p>"
              className="text-sm font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Page « Livraison rapide »</CardTitle>
          <CardDescription className="text-xs">URL : //livraison-rapide</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre de la page</Label>
            <Input value={form.trustPageShippingTitle || ''} onChange={e => set('trustPageShippingTitle', e.target.value)} placeholder="Livraison rapide" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contenu (HTML autorisé)</Label>
            <Textarea
              value={form.trustPageShippingContent || ''}
              onChange={e => set('trustPageShippingContent', e.target.value)}
              rows={8}
              placeholder="<h2>Livraison rapide</h2><p>Toutes nos commandes sont expédiées sous 48h...</p>"
              className="text-sm font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Page « Retours 14 jours »</CardTitle>
          <CardDescription className="text-xs">URL : //retours-14-jours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre de la page</Label>
            <Input value={form.trustPageReturnsTitle || ''} onChange={e => set('trustPageReturnsTitle', e.target.value)} placeholder="Retours 14 jours" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contenu (HTML autorisé)</Label>
            <Textarea
              value={form.trustPageReturnsContent || ''}
              onChange={e => set('trustPageReturnsContent', e.target.value)}
              rows={8}
              placeholder="<h2>Retours sous 14 jours</h2><p>Vous disposez de 14 jours pour retourner votre commande...</p>"
              className="text-sm font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Page Grades (A / B / C — badge cliquable sur la fiche produit) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Page « Grades de qualité »</CardTitle>
          <CardDescription className="text-xs">
            URL : //grade · Affichée quand un visiteur clique sur un badge Grade A/B/C depuis une fiche produit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre de la page</Label>
            <Input value={form.gradePageTitle || ''} onChange={e => set('gradePageTitle', e.target.value)} placeholder="Nos grades de qualité" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contenu (éditeur WYSIWYG — HTML généré automatiquement)</Label>
            <HtmlEditor
              value={form.gradePageContent || ''}
              onChange={(html) => set('gradePageContent', html)}
              placeholder="Expliquez ici la signification de chaque grade. Si vide, un contenu par défaut sera utilisé (Grade A vert = neuf, B jaune = très bon état, C orange = bon état)."
              minHeight={300}
            />
            <p className="text-[11px] text-muted-foreground">
              La légende colorée (A vert / B jaune / C orange) est toujours affichée en haut de la page, automatiquement.
            </p>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Horaires */}
      {subTab === 'misc' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horaires (footer)</CardTitle>
          <CardDescription className="text-xs">
            Activez ou désactivez l'affichage des horaires dans le footer de la boutique, et personnalisez chaque jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HoursEditor
            value={form.hoursJson}
            onChange={(json) => set('hoursJson', json)}
            visible={form.hoursVisible !== false}
            onVisibleChange={(v) => set('hoursVisible', v)}
          />
        </CardContent>
      </Card>
      )}

      {/* CGV */}
      {subTab === 'misc' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> CGV personnalisées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs">Texte des CGV (éditeur WYSIWYG — HTML généré automatiquement)</Label>
            <HtmlEditor
              value={form.cgvText || ''}
              onChange={(html) => set('cgvText', html)}
              placeholder="Rédigez vos CGV ici. Si vide, les CGV par défaut seront utilisées."
              minHeight={300}
            />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Mentions légales */}
      {subTab === 'misc' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Mentions légales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label className="text-xs">Texte des mentions légales (éditeur WYSIWYG)</Label>
            <HtmlEditor
              value={form.legalText || ''}
              onChange={(html) => set('legalText', html)}
              placeholder="Rédigez vos mentions légales ici. Si vide, des mentions légales par défaut seront utilisées."
              minHeight={300}
            />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Google Analytics */}
      {subTab === 'misc' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Google Analytics</CardTitle>
          <CardDescription className="text-xs">
            ID de mesure Google Analytics 4 (format : G-XXXXXXXXXX). Laisser vide pour désactiver.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">ID de mesure (GA4)</Label>
            <Input
              value={form.gaTagId || ''}
              onChange={e => set('gaTagId', e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="font-mono text-sm"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Le script GA4 sera injecté automatiquement sur toutes les pages de la boutique si un ID est renseigné.
            Créez votre propriété sur <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">analytics.google.com</a> pour obtenir votre ID.
          </p>
        </CardContent>
      </Card>
      )}

      {/* SEO */}
      {subTab === 'misc' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> SEO — Référencement</CardTitle>
          <CardDescription className="text-xs">
            Personnalisez le titre et la description affichés dans les onglets du navigateur et les résultats de recherche Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre de la page (balise &lt;title&gt;)</Label>
            <Input
              value={form.seoTitle || ''}
              onChange={e => set('seoTitle', e.target.value)}
              placeholder="Junashop — Vêtements et accessoires seconde main"
            />
            <p className="text-[11px] text-muted-foreground">Affiché dans l'onglet du navigateur. Si vide, le nom de la boutique est utilisé. Recommandé : 50-60 caractères.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (balise meta description)</Label>
            <Textarea
              value={form.seoDescription || ''}
              onChange={e => set('seoDescription', e.target.value)}
              rows={3}
              placeholder="Achetez des vêtements et accessoires seconde main soigneusement sélectionnés. Livraison rapide, paiement sécurisé."
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Affichée dans les résultats Google. Recommandé : 150-160 caractères.</p>
          </div>
        </CardContent>
      </Card>
      )}

      {/* RGPD / GDPR */}
      {subTab === 'misc' && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> RGPD — Consentement cookies</CardTitle>
          <CardDescription className="text-xs">
            Bannière de consentement cookies conforme au RGPD. Obligatoire pour les sites collectant des données personnelles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.gdprEnabled !== false}
              onCheckedChange={(v) => set('gdprEnabled', v)}
            />
            <Label className="text-sm cursor-pointer" onClick={() => set('gdprEnabled', form.gdprEnabled === false)}>
              {form.gdprEnabled !== false ? 'Bannière RGPD activée' : 'Bannière RGPD désactivée'}
            </Label>
          </div>
          {form.gdprEnabled !== false && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Titre de la bannière</Label>
                <Input
                  value={form.gdprBannerTitle || ''}
                  onChange={e => set('gdprBannerTitle', e.target.value)}
                  placeholder="Vos données personnelles"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message de la bannière</Label>
                <Textarea
                  value={form.gdprBannerMessage || ''}
                  onChange={e => set('gdprBannerMessage', e.target.value)}
                  rows={3}
                  placeholder="Nous utilisons des cookies pour améliorer votre expérience..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL de la politique de confidentialité</Label>
                <Input
                  value={form.gdprPrivacyPolicyUrl || ''}
                  onChange={e => set('gdprPrivacyPolicyUrl', e.target.value)}
                  placeholder="/mentions-legales"
                />
                <p className="text-[11px] text-muted-foreground">Lien affiché dans la bannière. Par défaut : page Mentions légales.</p>
              </div>
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-2.5 text-[11px] text-blue-800 dark:text-blue-200 space-y-1">
                <p>📋 <strong>Catégories de cookies par défaut :</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><strong>Cookies essentiels</strong> (panier, session) — obligatoires, non désactivables</li>
                  <li><strong>Cookies d'analyse</strong> (Google Analytics) — optionnels, refusables</li>
                </ul>
                <p className="mt-1">Le client peut : "Tout accepter" / "Refuser les optionnels" / "Personnaliser"</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Documents — bon de préparation + facture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documents — Bon de préparation & Facture</CardTitle>
          <CardDescription className="text-xs">
            Personnalisez le sous-titre du bon de préparation et le pied de page des factures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-titre du bon de préparation</Label>
            <Input
              value={form.preparationSlipSubtitle || ''}
              onChange={e => set('preparationSlipSubtitle', e.target.value)}
              placeholder="DBoxPro Boutique"
            />
            <p className="text-[11px] text-muted-foreground">Affiché sous "BON DE PRÉPARATION" en haut du document imprimable.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pied de page des factures</Label>
            <Textarea
              value={form.invoiceFooterText || ''}
              onChange={e => set('invoiceFooterText', e.target.value)}
              rows={2}
              placeholder="Document généré électroniquement par Reseller OS"
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              La date du jour sera automatiquement ajoutée à la fin (ex: « votre texte — 31/07/2026 »).
              Laissez vide pour utiliser le texte par défaut.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-20 flex justify-end bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-2 -mx-2 px-2">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Sauvegarder l'apparence
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 5 — LIVRAISON (modes + tranches de poids)
// ═══════════════════════════════════════════════════════════════════════════

interface ShippingMethodData {
  id: string
  code: string
  label: string
  price: number
  delay: string
  carrierCode: string | null
  active: boolean
  order: number
}

interface WeightRule {
  id: string
  weightMin: number
  weightMax: number
  price: number
}

function ShippingTab() {
  const { getByType } = useSettings()
  const carriers = getByType('carrier')
  const [methods, setMethods] = useState<ShippingMethodData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null)
  const [weightRules, setWeightRules] = useState<Record<string, WeightRule[]>>({})
  const [newRules, setNewRules] = useState<Record<string, { weightMin: string; weightMax: string; price: string }>>({})
  const [showCarrierForm, setShowCarrierForm] = useState(false)
  const [carrierForm, setCarrierForm] = useState({ value: '', code: '', trackingUrl: '' })
  // Free shipping config
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(50)
  const [savingFreeShip, setSavingFreeShip] = useState(false)
  const [showMethodForm, setShowMethodForm] = useState(false)
  const [methodForm, setMethodForm] = useState({ code: '', label: '', price: '', delay: '', carrierCode: '', order: '0' })
  const { attributes: allAttrs, refresh: refreshAttrs } = useSettings()
  // Mondial Relay config
  const [mrEnseigne, setMrEnseigne] = useState('')
  const [mrApiKey, setMrApiKey] = useState('')
  const [savingMr, setSavingMr] = useState(false)
  // Chronopost Shop2Shop config
  const [chronoAccount, setChronoAccount] = useState('')
  const [chronoApiKey, setChronoApiKey] = useState('')
  const [savingChrono, setSavingChrono] = useState(false)

  const fetchMethods = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/boutique/admin/shipping?all=true')
      const data = await res.json()
      setMethods(data.methods || [])
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch free shipping config
  const fetchFreeShipping = useCallback(async () => {
    try {
      const res = await fetch('/api/boutique/admin/settings')
      const data = await res.json()
      setFreeShippingEnabled(data.freeShippingEnabled ?? false)
      setFreeShippingThreshold(data.freeShippingThreshold ?? 50)
      setMrEnseigne(data.mondialRelayEnseigne || '')
      setMrApiKey(data.mondialRelayApiKey || '')
      setChronoAccount(data.chronopostAccountNumber || '')
      setChronoApiKey(data.chronopostApiKey || '')
    } catch {}
  }, [])

  // Save free shipping config
  const saveFreeShipping = async () => {
    setSavingFreeShip(true)
    try {
      await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeShippingEnabled, freeShippingThreshold }),
      })
      toast.success('Livraison offerte configurée')
    } catch {
      toast.error('Erreur')
    } finally {
      setSavingFreeShip(false)
    }
  }

  // Save Mondial Relay config (enseigne + clé API)
  const saveMondialRelay = async () => {
    setSavingMr(true)
    try {
      await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mondialRelayEnseigne: mrEnseigne.trim(),
          mondialRelayApiKey: mrApiKey.trim(),
        }),
      })
      toast.success('Configuration Mondial Relay enregistrée')
    } catch {
      toast.error('Erreur')
    } finally {
      setSavingMr(false)
    }
  }

  // Save Chronopost config
  const saveChronopost = async () => {
    setSavingChrono(true)
    try {
      await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chronopostAccountNumber: chronoAccount.trim(),
          chronopostApiKey: chronoApiKey.trim(),
        }),
      })
      toast.success('Configuration Chronopost enregistrée')
    } catch {
      toast.error('Erreur')
    } finally {
      setSavingChrono(false)
    }
  }

  useEffect(() => { fetchMethods(); fetchFreeShipping() }, [fetchMethods, fetchFreeShipping])

  const toggleActive = async (m: ShippingMethodData) => {
    await fetch(`/api/boutique/admin/shipping/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    })
    fetchMethods()
  }

  const removeMethod = async (id: string) => {
    if (!confirm('Supprimer ce mode de livraison ?')) return
    await fetch(`/api/boutique/admin/shipping/${id}`, { method: 'DELETE' })
    toast.success('Supprimé')
    fetchMethods()
  }

  const fetchWeightRules = async (methodId: string) => {
    try {
      const res = await fetch(`/api/boutique/admin/shipping-weight-rules?shippingMethodId=${methodId}`)
      const data = await res.json()
      setWeightRules(prev => ({ ...prev, [methodId]: data.rules || [] }))
    } catch {}
  }

  const toggleExpand = (methodId: string) => {
    if (expandedMethod === methodId) {
      setExpandedMethod(null)
    } else {
      setExpandedMethod(methodId)
      fetchWeightRules(methodId)
    }
  }

  const addCarrier = async () => {
    if (!carrierForm.value || !carrierForm.code) {
      toast.error('Nom et code requis')
      return
    }
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'carrier',
        value: carrierForm.value,
        code: carrierForm.code,
        trackingUrl: carrierForm.trackingUrl || null,
      }),
    })
    if (res.ok) {
      toast.success('Transporteur ajouté')
      setCarrierForm({ value: '', code: '', trackingUrl: '' })
      setShowCarrierForm(false)
      refreshAttrs()
    } else {
      toast.error('Erreur')
    }
  }

  const addWeightRule = async (methodId: string) => {
    const r = newRules[methodId] || { weightMin: '', weightMax: '', price: '' }
    if (!r.weightMin || !r.weightMax || !r.price) {
      toast.error('Tous les champs requis')
      return
    }
    await fetch('/api/boutique/admin/shipping-weight-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shippingMethodId: methodId,
        weightMin: parseFloat(r.weightMin),
        weightMax: parseFloat(r.weightMax),
        price: parseFloat(r.price),
      }),
    })
    setNewRules(prev => ({ ...prev, [methodId]: { weightMin: '', weightMax: '', price: '' } }))
    fetchWeightRules(methodId)
    toast.success('Tranche ajoutée')
  }

  const createMethod = async () => {
    if (!methodForm.code || !methodForm.label) {
      toast.error('Code et libellé requis')
      return
    }
    const res = await fetch('/api/boutique/admin/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: methodForm.code.trim().toLowerCase(),
        label: methodForm.label.trim(),
        price: parseFloat(methodForm.price) || 0,
        delay: methodForm.delay.trim(),
        carrierCode: methodForm.carrierCode || null,
        order: parseInt(methodForm.order) || 0,
        active: true,
      }),
    })
    if (res.ok) {
      toast.success('Mode de livraison créé')
      setMethodForm({ code: '', label: '', price: '', delay: '', carrierCode: '', order: '0' })
      setShowMethodForm(false)
      fetchMethods()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Erreur')
    }
  }

  const updateMethodCarrier = async (methodId: string, carrierCode: string) => {
    const res = await fetch(`/api/boutique/admin/shipping/${methodId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrierCode: carrierCode || null }),
    })
    if (res.ok) {
      toast.success('Transporteur mis à jour')
      fetchMethods()
    } else {
      toast.error('Erreur')
    }
  }

  const removeWeightRule = async (ruleId: string, methodId: string) => {
    await fetch(`/api/boutique/admin/shipping-weight-rules/${ruleId}`, { method: 'DELETE' })
    fetchWeightRules(methodId)
    toast.success('Tranche supprimée')
  }

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-4">
      {/* Configuration Mondial Relay */}
      <Card className={!mrEnseigne || !mrApiKey ? 'border-amber-300' : 'border-green-300'}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Configuration Mondial Relay
            {mrEnseigne && mrApiKey
              ? <Badge className="bg-green-600 hover:bg-green-600">Configuré</Badge>
              : <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">À configurer</Badge>
            }
          </CardTitle>
          <CardDescription className="text-xs">
            Identifiants pour l'API Mondial Relay (recherche de points relais et création d'étiquettes).
            Sans ces identifiants, la recherche de points relais utilise des données de démonstration (mock).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Enseigne (code client)</Label>
              <Input
                value={mrEnseigne}
                onChange={e => setMrEnseigne(e.target.value)}
                placeholder="Ex : BOUTIQUE01"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Code enseigne fourni par Mondial Relay lors de l'ouverture du compte.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Clé API / clé privée</Label>
              <Input
                type="password"
                value={mrApiKey}
                onChange={e => setMrApiKey(e.target.value)}
                placeholder="Clé secrète"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Utilisée pour signer les requêtes (hash de sécurité).</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveMondialRelay} disabled={savingMr}>
              {savingMr ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Enregistrer
            </Button>
            <span className="text-[11px] text-muted-foreground">
              🔒 Les identifiants sont stockés dans la base locale et ne sont jamais exposés au client.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Chronopost Shop2Shop */}
      <Card className={!chronoAccount || !chronoApiKey ? 'border-amber-300' : 'border-green-300'}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Configuration Chronopost Shop2Shop
            {chronoAccount && chronoApiKey
              ? <Badge className="bg-green-600 hover:bg-green-600">Configuré</Badge>
              : <Badge variant="secondary">Non configuré</Badge>
            }
          </CardTitle>
          <CardDescription className="text-xs">
            Identifiants API Chronopost pour la recherche de points relais Pickup.
            Créez votre compte sur <a href="https://www.chronopost.fr/fr/espace-client" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">chronopost.fr</a> → Espace Client → API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Numéro de compte Chronopost</Label>
              <Input
                value={chronoAccount}
                onChange={e => setChronoAccount(e.target.value)}
                placeholder="Ex: 12345678"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Numéro de compte marchand Chronopost (8 chiffres).</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Clé API</Label>
              <Input
                value={chronoApiKey}
                onChange={e => setChronoApiKey(e.target.value)}
                placeholder="Clé API / mot de passe API"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Clé utilisée pour authentifier les requêtes API.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveChronopost} disabled={savingChrono}>
              {savingChrono ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Enregistrer
            </Button>
            <span className="text-[11px] text-muted-foreground">
              🔒 Les identifiants sont stockés dans la base locale et ne sont jamais exposés au client.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Livraison offerte */}
      <Card className={freeShippingEnabled ? 'border-green-400 bg-green-50/50 dark:bg-green-950/20' : ''}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Truck className="h-4 w-4" /> Livraison offerte
            {freeShippingEnabled
              ? <Badge className="bg-green-600 hover:bg-green-600">Activée</Badge>
              : <Badge variant="secondary">Désactivée</Badge>
            }
          </CardTitle>
          <CardDescription className="text-xs">
            Active la livraison gratuite dès un certain montant d'achat. Si désactivé, les frais de port normaux s'appliquent toujours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={freeShippingEnabled}
              onCheckedChange={(v) => setFreeShippingEnabled(v)}
            />
            <Label className="text-sm cursor-pointer" onClick={() => setFreeShippingEnabled(!freeShippingEnabled)}>
              {freeShippingEnabled ? 'Livraison offerte activée' : 'Livraison offerte désactivée'}
            </Label>
          </div>
          {freeShippingEnabled && (
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Seuil de livraison offerte (€)</Label>
              <Input
                type="number"
                value={freeShippingThreshold}
                onChange={e => setFreeShippingThreshold(parseFloat(e.target.value) || 0)}
                placeholder="50"
              />
              <p className="text-[11px] text-muted-foreground">Au-dessus de ce montant, la livraison est offerte automatiquement au client.</p>
            </div>
          )}
          <Button size="sm" onClick={saveFreeShipping} disabled={savingFreeShip}>
            {savingFreeShip ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Sauvegarder
          </Button>
        </CardContent>
      </Card>

      {/* Transporteurs depuis attributs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Transporteurs disponibles</CardTitle>
          <CardDescription className="text-xs">Gérés depuis Paramètres → Attributs → Transporteurs. Utilisés pour le suivi des colis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {carriers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Aucun transporteur configuré.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {carriers.map(c => (
                <Badge key={c.id} variant="secondary" className="gap-1 text-xs py-1.5">
                  <Truck className="h-3 w-3" />
                  {c.value}
                  {c.trackingUrl && <span className="text-[9px] text-green-600 ml-1">✓ suivi</span>}
                </Badge>
              ))}
            </div>
          )}
          {showCarrierForm ? (
            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nom</Label>
                  <Input value={carrierForm.value} onChange={e => setCarrierForm({ ...carrierForm, value: e.target.value })} placeholder="Chronopost" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Code</Label>
                  <Input value={carrierForm.code} onChange={e => setCarrierForm({ ...carrierForm, code: e.target.value })} placeholder="chronopost" className="h-8 text-sm font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL de suivi (optionnel)</Label>
                <Input value={carrierForm.trackingUrl} onChange={e => setCarrierForm({ ...carrierForm, trackingUrl: e.target.value })} placeholder="https://...{tracking}" className="h-8 text-xs font-mono" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowCarrierForm(false)}>Annuler</Button>
                <Button size="sm" onClick={addCarrier}>Ajouter</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowCarrierForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter un transporteur
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modes de livraison */}
      <div className="flex items-center justify-between">
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200 flex-1 mr-3">
          💡 Les tranches de poids permettent de calculer automatiquement les frais de port selon le poids total des articles du panier. Si aucune tranche n'est définie, le prix de base est utilisé. Désactivez un mode pour le masquer lors du checkout client.
        </div>
        <Button size="sm" onClick={() => setShowMethodForm(!showMethodForm)}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau mode
        </Button>
      </div>

      {showMethodForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nouveau mode de livraison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input value={methodForm.code} onChange={e => setMethodForm({ ...methodForm, code: e.target.value })} placeholder="chronopost" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Libellé</Label>
                <Input value={methodForm.label} onChange={e => setMethodForm({ ...methodForm, label: e.target.value })} placeholder="Chronopost Express" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Délai</Label>
                <Input value={methodForm.delay} onChange={e => setMethodForm({ ...methodForm, delay: e.target.value })} placeholder="24-48h" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Prix base (€)</Label>
                <Input type="number" step="0.01" value={methodForm.price} onChange={e => setMethodForm({ ...methodForm, price: e.target.value })} placeholder="4.90" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordre</Label>
                <Input type="number" value={methodForm.order} onChange={e => setMethodForm({ ...methodForm, order: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transporteur</Label>
                <select
                  value={methodForm.carrierCode}
                  onChange={e => setMethodForm({ ...methodForm, carrierCode: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Aucun —</option>
                  {carriers.map(c => (
                    <option key={c.id} value={c.code}>{c.value}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowMethodForm(false)}>Annuler</Button>
              <Button size="sm" onClick={createMethod}>Créer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {methods.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aucun mode de livraison. Cliquez sur "Nouveau mode" ci-dessus pour en créer un.
        </CardContent></Card>
      ) : (
        methods.map(m => (
          <Card key={m.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{m.code}</code>
                    {m.delay && ` · ${m.delay}`}
                    {' · '}Prix base : {m.price === 0 ? 'Gratuit' : `${m.price.toFixed(2)} €`}
                  </p>
                </div>
                <Badge variant={m.active ? 'default' : 'secondary'}>{m.active ? 'Actif' : 'Inactif'}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleActive(m)}>
                  {m.active ? 'Désactiver' : 'Activer'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleExpand(m.id)}>
                  <ChevronRight className={`h-3.5 w-3.5 mr-1 transition-transform ${expandedMethod === m.id ? 'rotate-90' : ''}`} />
                  Tranches de poids
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeMethod(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Carrier selector (inline) */}
              <div className="mt-3 pt-3 border-t flex items-center gap-3">
                <Label className="text-xs font-semibold shrink-0">Transporteur :</Label>
                <select
                  value={m.carrierCode || ''}
                  onChange={e => updateMethodCarrier(m.id, e.target.value)}
                  className="flex h-8 w-auto rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Aucun —</option>
                  {carriers.map(c => (
                    <option key={c.id} value={c.code}>{c.value}</option>
                  ))}
                </select>
                {m.carrierCode && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Truck className="h-3 w-3" />
                    {carriers.find(c => c.code === m.carrierCode)?.value || m.carrierCode}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Le transporteur est lié au suivi des colis (URL de tracking configurable dans Paramètres → Attributs).
                </span>
              </div>

              {/* Weight rules */}
              {expandedMethod === m.id && (
                <div className="mt-4 pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Tranches de poids (grammes)</p>
                    <span className="text-[11px] text-muted-foreground">Calcul auto selon le poids total du panier</span>
                  </div>
                  {(weightRules[m.id] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Aucune tranche définie — le prix de base ({m.price.toFixed(2)} €) est utilisé pour tous les poids.</p>
                  ) : (
                    <div className="space-y-1">
                      {(weightRules[m.id] || []).map(r => (
                        <div key={r.id} className="flex items-center gap-2 text-xs p-2 border rounded">
                          <span className="flex-1">{r.weightMin}g - {r.weightMax}g</span>
                          <Badge variant="secondary">{r.price.toFixed(2)} €</Badge>
                          <Button size="sm" variant="ghost" className="text-red-600 h-6" onClick={() => removeWeightRule(r.id, m.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add rule */}
                  <div className="flex gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Min (g)</Label>
                      <Input type="number" value={(newRules[m.id] || { weightMin: '' }).weightMin} onChange={e => setNewRules(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || { weightMin: '', weightMax: '', price: '' }), weightMin: e.target.value } }))} className="w-20 h-8 text-xs" placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Max (g)</Label>
                      <Input type="number" value={(newRules[m.id] || { weightMax: '' }).weightMax} onChange={e => setNewRules(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || { weightMin: '', weightMax: '', price: '' }), weightMax: e.target.value } }))} className="w-20 h-8 text-xs" placeholder="500" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Prix (€)</Label>
                      <Input type="number" step="0.01" value={(newRules[m.id] || { price: '' }).price} onChange={e => setNewRules(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || { weightMin: '', weightMax: '', price: '' }), price: e.target.value } }))} className="w-20 h-8 text-xs" placeholder="3.50" />
                    </div>
                    <Button size="sm" onClick={() => addWeightRule(m.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 6 — CATÉGORIES (placeholder — déjà géré dans Paramètres → Boutique)
// ═══════════════════════════════════════════════════════════════════════════

interface CategoryData {
  slug: string
  label: string
  parentId: string | null
  backgroundImage: string | null
  bgColor: string | null
  bgOpacity: number
  emoji: string
  order: number
  filtersJson?: string | null
}

// Filter types configurable per category — used by the storefront sidebar.
const FILTER_TYPES = [
  { type: 'size', defaultLabel: 'Taille' },
  { type: 'color', defaultLabel: 'Couleur' },
  { type: 'condition', defaultLabel: 'État' },
  { type: 'brand', defaultLabel: 'Marque' },
] as const

interface CategoryFilter {
  type: string
  label: string
  active: boolean
  collapsed: boolean
}

function parseFilters(json: string | null | undefined): CategoryFilter[] {
  try {
    const arr = JSON.parse(json || '[]')
    if (!Array.isArray(arr)) return []
    // Merge with FILTER_TYPES to ensure all known types are present + sane defaults
    return FILTER_TYPES.map(ft => {
      const found = arr.find((x: any) => x && x.type === ft.type)
      return {
        type: ft.type,
        label: (found && typeof found.label === 'string' && found.label) || ft.defaultLabel,
        active: !!(found && found.active),
        collapsed: !!(found && found.collapsed),
      }
    })
  } catch {
    return FILTER_TYPES.map(ft => ({ type: ft.type, label: ft.defaultLabel, active: false, collapsed: false }))
  }
}

function CategoriesTab() {
  const [cats, setCats] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CategoryData | null>(null)
  const [editFilters, setEditFilters] = useState<CategoryFilter[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCat, setNewCat] = useState({ slug: '', label: '', emoji: '📦', parentId: '' })
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10 // top-level categories per page

  const fetchCats = () => {
    fetch('/api/boutique/admin/categories')
      .then(r => r.json())
      .then(data => setCats(data.categories || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCats() }, [])

  const startEdit = (c: CategoryData) => {
    setEditing(c.slug)
    setEditForm({
      ...c,
      parentId: c.parentId ?? null,
      bgColor: c.bgColor ?? null,
      bgOpacity: c.bgOpacity ?? 0.5,
    })
    setEditFilters(parseFilters(c.filtersJson))
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditForm(null)
    setEditFilters([])
  }

  const updateFilter = (idx: number, patch: Partial<CategoryFilter>) => {
    setEditFilters(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  const saveEdit = async () => {
    if (!editForm) return
    try {
      const res = await fetch(`/api/boutique/admin/categories/${editForm.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editForm.label,
          emoji: editForm.emoji,
          backgroundImage: editForm.backgroundImage,
          bgColor: editForm.bgColor,
          bgOpacity: editForm.bgOpacity,
          order: editForm.order,
          parentId: editForm.parentId,
          filtersJson: JSON.stringify(editFilters),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
        return
      }
      toast.success('Catégorie mise à jour')
      cancelEdit()
      fetchCats()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const uploadImage = async (slug: string, file: File) => {
    setUploading(slug)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('slug', slug)
      const res = await fetch('/api/boutique/admin/categories/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur upload'); return }

      // Update via PATCH
      await fetch(`/api/boutique/admin/categories/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backgroundImage: data.path }),
      })
      toast.success('Image mise à jour')
      fetchCats()
      // Also update edit form if editing this cat
      if (editForm && editForm.slug === slug) {
        setEditForm({ ...editForm, backgroundImage: data.path })
      }
    } catch { toast.error('Erreur réseau') }
    finally { setUploading(null) }
  }

  const removeImage = async (slug: string) => {
    if (!confirm('Supprimer l\'image de fond ?')) return
    await fetch(`/api/boutique/admin/categories/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backgroundImage: null }),
    })
    toast.success('Image supprimée')
    fetchCats()
    if (editForm && editForm.slug === slug) {
      setEditForm({ ...editForm, backgroundImage: null })
    }
  }

  const deleteCat = async (slug: string) => {
    if (!confirm(`Supprimer la catégorie "${slug}" ?`)) return
    const res = await fetch(`/api/boutique/admin/categories/${slug}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Catégorie supprimée')
      fetchCats()
    } else {
      toast.error('Erreur')
    }
  }

  const createCat = async () => {
    if (!newCat.slug || !newCat.label) {
      toast.error('Slug et libellé requis')
      return
    }
    const res = await fetch('/api/boutique/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: newCat.slug.toLowerCase().trim(),
        label: newCat.label,
        emoji: newCat.emoji || '📦',
        parentId: newCat.parentId || null,
        order: cats.length,
      }),
    })
    if (res.ok) {
      toast.success(newCat.parentId ? 'Sous-catégorie ajoutée' : 'Catégorie ajoutée')
      setNewCat({ slug: '', label: '', emoji: '📦', parentId: '' })
      setShowAddForm(false)
      fetchCats()
    } else {
      const data = await res.json()
      toast.error(data.error || 'Erreur')
    }
  }

  // Build a tree-sorted list: each parent immediately followed by its children
  // MUST be called before any conditional return (Rules of Hooks)
  const sortedCats = useMemo(() => {
    const tops = cats.filter(c => !c.parentId).sort((a, b) => a.order - b.order)
    const result: CategoryData[] = []
    for (const t of tops) {
      result.push(t)
      const subs = cats.filter(c => c.parentId === t.slug).sort((a, b) => a.order - b.order)
      result.push(...subs)
    }
    // Include orphans (parentId set but parent was deleted)
    const knownSlugs = new Set(result.map(c => c.slug))
    const orphans = cats.filter(c => !knownSlugs.has(c.slug))
    result.push(...orphans)
    return result
  }, [cats])

  // Pagination: count top-level categories (parents), paginate on them
  const topCatsCount = useMemo(() => cats.filter(c => !c.parentId).length, [cats])
  const totalPages = Math.max(1, Math.ceil(topCatsCount / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedTopSlugs = useMemo(() => {
    const tops = cats.filter(c => !c.parentId).sort((a, b) => a.order - b.order)
    const start = (safeCurrentPage - 1) * pageSize
    return tops.slice(start, start + pageSize).map(c => c.slug)
  }, [cats, safeCurrentPage])

  // Filter sortedCats to only show items for the current page
  const visibleCats = useMemo(() => {
    return sortedCats.filter(c => {
      // Top-level: must be in the current page's parent slugs
      if (!c.parentId) return paginatedTopSlugs.includes(c.slug)
      // Subcategory: show only if its parent is on the current page AND not collapsed
      if (!paginatedTopSlugs.includes(c.parentId)) return false
      if (collapsedParents.has(c.parentId)) return false
      return true
    })
  }, [sortedCats, paginatedTopSlugs, collapsedParents])

  const toggleCollapse = (slug: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Personnalisez chaque catégorie : image de fond, couleur de fond, opacité, emoji, ordre.
        </p>
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle catégorie
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Slug (URL)</Label>
              <Input value={newCat.slug} onChange={e => setNewCat({ ...newCat, slug: e.target.value })} placeholder="vetements" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Libellé</Label>
              <Input value={newCat.label} onChange={e => setNewCat({ ...newCat, label: e.target.value })} placeholder="Vêtements" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Emoji</Label>
              <Input value={newCat.emoji} onChange={e => setNewCat({ ...newCat, emoji: e.target.value })} placeholder="👕" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie parente</Label>
              <select
                value={newCat.parentId}
                onChange={e => setNewCat({ ...newCat, parentId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Aucune (catégorie principale) —</option>
                {cats.filter(c => !c.parentId).map(c => (
                  <option key={c.slug} value={c.slug}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <Button onClick={createCat}>Créer</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {visibleCats.map(c => {
          const isChild = !!c.parentId
          const isParent = !c.parentId && cats.some(cc => cc.parentId === c.slug)
          const isCollapsed = isParent && collapsedParents.has(c.slug)
          return (
          <Card key={c.slug} className={isChild ? 'ml-8 border-l-4 border-l-blue-300' : ''}>
            <CardContent className="pt-4">
              {editing === c.slug && editForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Libellé</Label>
                      <Input value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Emoji</Label>
                      <Input value={editForm.emoji} onChange={e => setEditForm({ ...editForm, emoji: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ordre</Label>
                      <Input type="number" value={editForm.order} onChange={e => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Slug (non modifiable)</Label>
                      <Input value={editForm.slug} disabled className="font-mono text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Catégorie parente</Label>
                      <select
                        value={editForm.parentId || ''}
                        onChange={e => setEditForm({ ...editForm, parentId: e.target.value || null })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">— Aucune (catégorie principale) —</option>
                        {cats.filter(c => !c.parentId && c.slug !== editForm.slug).map(c => (
                          <option key={c.slug} value={c.slug}>{c.emoji} {c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                    {/* Image de fond */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Image de fond</Label>
                      <div className="flex gap-2 items-start">
                        <div className="w-24 h-16 rounded-md overflow-hidden border-2 border-dashed bg-muted/40 shrink-0 flex items-center justify-center">
                          {editForm.backgroundImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={editForm.backgroundImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl opacity-30">{editForm.emoji}</span>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(editForm.slug, f) }}
                            />
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-md text-xs font-medium hover:bg-muted cursor-pointer">
                              <Upload className="h-3.5 w-3.5" /> {uploading === editForm.slug ? 'Upload...' : 'Uploader'}
                            </span>
                          </label>
                          {editForm.backgroundImage && (
                            <Button size="sm" variant="outline" onClick={() => removeImage(editForm.slug)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Retirer
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Couleur de fond + Opacité */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Couleur de fond (si pas d'image, ou derrière l'image)</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={editForm.bgColor ? '#' + editForm.bgColor : '#000000'}
                          onChange={e => setEditForm({ ...editForm, bgColor: e.target.value.replace('#', '') })}
                          className="w-10 h-9 rounded border cursor-pointer shrink-0"
                          title="Couleur de fond"
                        />
                        <Input
                          value={editForm.bgColor ? '#' + editForm.bgColor : ''}
                          onChange={e => setEditForm({ ...editForm, bgColor: e.target.value.replace('#', '') || null })}
                          placeholder="Laisser vide = défaut"
                          className="font-mono text-xs flex-1"
                        />
                        {editForm.bgColor && (
                          <Button size="sm" variant="ghost" onClick={() => setEditForm({ ...editForm, bgColor: null })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Opacité de l'image de fond : <span className="font-mono">{Math.round((editForm.bgOpacity ?? 0.5) * 100)}%</span>
                        </Label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={editForm.bgOpacity ?? 0.5}
                          onChange={e => setEditForm({ ...editForm, bgOpacity: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                        <p className="text-[11px] text-muted-foreground">0% = transparent (couleur de fond visible), 100% = opaque (image visible)</p>
                      </div>
                    </div>
                  </div>

                  {/* Aperçu */}
                  <div className="space-y-1.5 pt-2 border-t">
                    <Label className="text-xs font-semibold">Aperçu</Label>
                    <div
                      className="relative rounded-lg overflow-hidden aspect-[3/1] flex items-end p-3"
                      style={{
                        backgroundColor: editForm.bgColor ? '#' + editForm.bgColor : '#007bff',
                      }}
                    >
                      {editForm.backgroundImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={editForm.backgroundImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ opacity: editForm.bgOpacity ?? 0.5 }}
                        />
                      )}
                      <div className="relative z-10 text-white">
                        <span className="text-2xl mr-2">{editForm.emoji}</span>
                        <span className="font-bold text-lg">{editForm.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Filtres de la catégorie */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5" /> Filtres de la catégorie
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Activez les filtres disponibles dans la sidebar de la page catégorie. Personnalisez le libellé (ex. « Pointure » au lieu de « Taille ») et choisissez si le filtre est replié par défaut.
                    </p>
                    <div className="space-y-2">
                      {editFilters.map((f, idx) => (
                        <div
                          key={f.type}
                          className={cn(
                            'flex flex-wrap items-center gap-3 p-2.5 rounded-md border',
                            f.active ? 'border-foreground/30 bg-card' : 'border-border/60 bg-card/50 opacity-70',
                          )}
                        >
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={f.active}
                              onCheckedChange={(v) => updateFilter(idx, { active: v })}
                            />
                            <span className="text-xs font-medium w-16 capitalize">
                              {FILTER_TYPES.find(ft => ft.type === f.type)?.defaultLabel || f.type}
                            </span>
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <Input
                              value={f.label}
                              onChange={(e) => updateFilter(idx, { label: e.target.value })}
                              placeholder="Libellé affiché"
                              className="h-8 text-sm"
                            />
                          </div>
                          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={f.collapsed}
                              onChange={(e) => updateFilter(idx, { collapsed: e.target.checked })}
                              className="rounded"
                            />
                            Replié par défaut
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={cancelEdit}>Annuler</Button>
                    <Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Collapse toggle for parents */}
                  {isParent && (
                    <button
                      onClick={() => toggleCollapse(c.slug)}
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground"
                      title={isCollapsed ? "Déplier les sous-catégories" : "Replier les sous-catégories"}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                    </button>
                  )}
                  {!isParent && <div className="w-6 shrink-0" />}
                  <div
                    className="w-24 h-16 rounded-md overflow-hidden border shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: c.bgColor ? '#' + c.bgColor : undefined }}
                  >
                    {c.backgroundImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.backgroundImage} alt={c.label} className="w-full h-full object-cover" style={{ opacity: c.bgOpacity ?? 0.5 }} />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-2xl opacity-50">{c.emoji}</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      {c.emoji} {c.label}
                      {c.parentId && (
                        <Badge variant="outline" className="text-[10px] py-0 h-5">
                          ↳ {cats.find(p => p.slug === c.parentId)?.label || c.parentId}
                        </Badge>
                      )}
                      {isParent && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-5">
                          {cats.filter(cc => cc.parentId === c.slug).length} sous-cat(s)
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{c.slug}</code>
                      {c.bgColor && (
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block w-3 h-3 rounded border" style={{ backgroundColor: '#' + c.bgColor }} />
                          #{c.bgColor}
                        </span>
                      )}
                      <span>· opacity {Math.round((c.bgOpacity ?? 0.5) * 100)}%</span>
                      <span>· ordre {c.order}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                      <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCat(c.slug)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Page {safeCurrentPage} sur {totalPages} · {topCatsCount} catégorie(s) principale(s)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
            >
              ← Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Expand/collapse all */}
      {topCatsCount > 3 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const allParents = cats.filter(c => !c.parentId).map(c => c.slug)
              const allCollapsed = allParents.every(s => collapsedParents.has(s))
              if (allCollapsed) {
                setCollapsedParents(new Set())
              } else {
                setCollapsedParents(new Set(allParents))
              }
            }}
          >
            {cats.filter(c => !c.parentId).map(c => c.slug).every(s => collapsedParents.has(s)) ? 'Tout déplier' : 'Tout replier'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET PAIEMENTS
// ═══════════════════════════════════════════════════════════════════════════

function PaymentsTab() {
  const [methods, setMethods] = useState<Array<{
    id: string; code: string; label: string; description: string | null;
    icon: string | null; provider: string; active: boolean; order: number;
    feesFixed: number; feesPercent: number;
  }>>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingMethod, setEditingMethod] = useState<typeof methods[0] | null>(null)
  const [form, setForm] = useState({
    code: '', label: '', description: '', icon: '💳', provider: 'demo',
    feesFixed: '0', feesPercent: '0',
  })

  // API keys state (stored in BoutiqueSettings, not PaymentMethod)
  const [apiKeys, setApiKeys] = useState({
    stripePublicKey: '', stripeSecretKey: '', stripeWebhookSecret: '',
    paypalClientId: '', paypalSecret: '',
  })
  const [savingKeys, setSavingKeys] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  const fetchMethods = () => {
    fetch('/api/boutique/admin/payments')
      .then(r => r.json())
      .then(data => setMethods(data.methods || []))
      .finally(() => setLoading(false))
  }

  const fetchApiKeys = () => {
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => {
        setApiKeys({
          stripePublicKey: data.stripePublicKey || '',
          stripeSecretKey: data.stripeSecretKey || '',
          stripeWebhookSecret: data.stripeWebhookSecret || '',
          paypalClientId: data.paypalClientId || '',
          paypalSecret: data.paypalSecret || '',
        })
      })
      .catch(() => {})
  }

  useEffect(() => { fetchMethods(); fetchApiKeys() }, [])

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
      setForm({ code: '', label: '', description: '', icon: '💳', provider: 'demo', feesFixed: '0', feesPercent: '0' })
      setShowForm(false)
      fetchMethods()
    } else {
      toast.error('Erreur')
    }
  }

  const saveApiKeys = async () => {
    setSavingKeys(true)
    try {
      const res = await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiKeys),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Clés API sauvegardées')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSavingKeys(false)
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

  const startEdit = (m: typeof methods[0]) => {
    setEditingMethod(m)
    setForm({
      code: m.code,
      label: m.label,
      description: m.description || '',
      icon: m.icon || '💳',
      provider: m.provider,
      feesFixed: String(m.feesFixed || 0),
      feesPercent: String(m.feesPercent || 0),
    })
  }

  const saveEdit = async () => {
    if (!editingMethod) return
    if (!form.label) {
      toast.error('Libellé requis')
      return
    }
    const res = await fetch(`/api/boutique/admin/payments/${editingMethod.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.label,
        description: form.description,
        icon: form.icon,
        provider: form.provider,
        feesFixed: form.feesFixed,
        feesPercent: form.feesPercent,
      }),
    })
    if (res.ok) {
      toast.success('Mode de paiement modifié')
      setEditingMethod(null)
      fetchMethods()
    } else {
      toast.error('Erreur')
    }
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

  // Check if any payment method uses stripe or paypal
  const hasStripe = methods.some(m => m.provider === 'stripe')
  const hasPaypal = methods.some(m => m.provider === 'paypal')

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
        💡 <strong>Mode démo :</strong> simule un paiement (aucune transaction réelle). <strong>Stripe/PayPal :</strong> nécessite clés API (configurées ci-dessous). <strong>Manuel :</strong> virement, chèque, etc.
      </div>

      {/* Payment methods list */}
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
                {(m.feesFixed > 0 || m.feesPercent > 0) && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    💰 Frais bancaires : {m.feesFixed > 0 && `${Number(m.feesFixed).toFixed(2)}€ fixe`}
                    {m.feesFixed > 0 && m.feesPercent > 0 && ' + '}
                    {m.feesPercent > 0 && `${Number(m.feesPercent).toFixed(2)}%`}
                    {' '}→ déduits du CA sur chaque vente
                  </p>
                )}
              </div>
              <Badge variant={m.active ? 'default' : 'secondary'}>
                {m.active ? 'Actif' : 'Inactif'}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => startEdit(m)}>
                <Edit className="h-3.5 w-3.5 mr-1" /> Éditer
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleActive(m)}>
                {m.active ? 'Désactiver' : 'Activer'}
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Edit payment method dialog */}
      <Dialog open={!!editingMethod} onOpenChange={(o) => !o && setEditingMethod(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le mode de paiement</DialogTitle>
            <DialogDescription>
              Code : <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{editingMethod?.code}</code> (non modifiable)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Libellé</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Carte bancaire (Stripe)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Paiement sécurisé par carte bancaire" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Frais fixes (€)</Label>
                <Input type="number" step="0.01" min="0" value={form.feesFixed} onChange={e => setForm({ ...form, feesFixed: e.target.value })} placeholder="0.00" />
                <p className="text-[10px] text-muted-foreground">Ex: Stripe = 0.25€ par transaction</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Frais variables (%)</Label>
                <Input type="number" step="0.01" min="0" max="100" value={form.feesPercent} onChange={e => setForm({ ...form, feesPercent: e.target.value })} placeholder="0.00" />
                <p className="text-[10px] text-muted-foreground">Ex: Stripe = 1.40% (CB européenne)</p>
              </div>
            </div>
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-2.5 text-[11px] text-blue-800 dark:text-blue-200">
              💡 <strong>Exemple Stripe France :</strong> 0.25€ fixe + 1.40% variable.
              Pour une commande de 55€ : frais = 0.25 + (55 × 1.40 / 100) = <strong>1.02€</strong> déduits du CA.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingMethod(null)}>Annuler</Button>
            <Button onClick={saveEdit}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add payment method form */}
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
            <div className="space-y-1">
              <Label className="text-xs">Frais fixes (€)</Label>
              <Input type="number" step="0.01" min="0" value={form.feesFixed} onChange={e => setForm({ ...form, feesFixed: e.target.value })} placeholder="0.00" />
              <p className="text-[10px] text-muted-foreground">Ex: Stripe = 0.00€ (frais fixe par transaction)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frais variables (%)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={form.feesPercent} onChange={e => setForm({ ...form, feesPercent: e.target.value })} placeholder="0.00" />
              <p className="text-[10px] text-muted-foreground">Ex: Stripe = 1.40% + 0.25€ (CB européenne)</p>
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

      {/* Stripe configuration */}
      <Card className={hasStripe ? 'border-purple-300' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">💳</span> Configuration Stripe
            {hasStripe
              ? <Badge className="bg-green-600 hover:bg-green-600">Utilisé</Badge>
              : <Badge variant="secondary">Non utilisé</Badge>
            }
          </CardTitle>
          <CardDescription className="text-xs">
            Clés API depuis <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dashboard.stripe.com/apikeys</a>.
            Utilise les clés <strong>test</strong> (pk_test_ / sk_test_) pour tester, et les clés <strong>live</strong> (pk_live_ / sk_live_) pour la production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Clé publique (Publishable key)</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={apiKeys.stripePublicKey}
              onChange={e => setApiKeys({ ...apiKeys, stripePublicKey: e.target.value })}
              placeholder="pk_test_... ou pk_live_..."
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Clé secrète (Secret key)</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={apiKeys.stripeSecretKey}
              onChange={e => setApiKeys({ ...apiKeys, stripeSecretKey: e.target.value })}
              placeholder="sk_test_... ou sk_live_..."
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook Secret (optionnel, recommandé)</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={apiKeys.stripeWebhookSecret || ''}
              onChange={e => setApiKeys({ ...apiKeys, stripeWebhookSecret: e.target.value })}
              placeholder="whsec_..."
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Trouvé dans le Dashboard Stripe → Developers → Webhooks → clic sur votre endpoint → « Signing secret ».
              Sans cette clé, les webhooks ne sont pas vérifiés (OK en test, recommandé en production).
            </p>
          </div>
          <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 p-2.5 text-[11px] text-purple-800 dark:text-purple-200 space-y-1">
            <p>📋 <strong>Webhook Stripe :</strong> configure un endpoint sur <code>https://junashop.fr/api/webhooks/stripe</code> dans le dashboard Stripe → Developers → Webhooks → Add endpoint.</p>
            <p>📌 <strong>Événements à écouter :</strong> <code>payment_intent.succeeded</code> et <code>payment_intent.payment_failed</code></p>
            <p>✅ <strong>SDK Stripe installé :</strong> <code>stripe</code> + <code>@stripe/stripe-js</code> — le formulaire CB est automatiquement disponible sur la page de paiement.</p>
          </div>
        </CardContent>
      </Card>

      {/* PayPal configuration */}
      <Card className={hasPaypal ? 'border-blue-300' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">🅿️</span> Configuration PayPal
            {hasPaypal
              ? <Badge className="bg-green-600 hover:bg-green-600">Utilisé</Badge>
              : <Badge variant="secondary">Non utilisé</Badge>
            }
          </CardTitle>
          <CardDescription className="text-xs">
            Credentials depuis <a href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developer.paypal.com</a>.
            Utilise les credentials <strong>Sandbox</strong> pour tester, et <strong>Live</strong> pour la production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Client ID</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={apiKeys.paypalClientId}
              onChange={e => setApiKeys({ ...apiKeys, paypalClientId: e.target.value })}
              placeholder="AY... (sandbox) ou AR... (live)"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Secret</Label>
            <Input
              type={showSecrets ? 'text' : 'password'}
              value={apiKeys.paypalSecret}
              onChange={e => setApiKeys({ ...apiKeys, paypalSecret: e.target.value })}
              placeholder="EJ... (sandbox) ou EG... (live)"
              className="font-mono text-xs"
            />
          </div>
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-2.5 text-[11px] text-blue-800 dark:text-blue-200 space-y-1">
            <p>📋 <strong>Webhook PayPal :</strong> configure un endpoint sur <code>https://junashop.fr/api/webhooks/paypal</code> dans le dashboard PayPal.</p>
            <p>🔧 Pour installer le SDK PayPal : <code>npm install @paypal/checkout-server-sdk</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Save + toggle secrets */}
      <div className="flex items-center justify-between gap-3 sticky bottom-4 z-20 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-2 -mx-2 px-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showSecrets}
            onChange={e => setShowSecrets(e.target.checked)}
            className="rounded"
          />
          Afficher les clés secrètes
        </label>
        <Button onClick={saveApiKeys} disabled={savingKeys} size="lg" className="shadow-lg">
          {savingKeys ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Sauvegarder les clés API
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 8 — COUPONS DE RÉDUCTION
// ═══════════════════════════════════════════════════════════════════════════

interface Coupon {
  id: string
  code: string
  name: string
  description: string | null
  type: string       // 'percent' | 'fixed'
  value: number
  minAmount: number
  startsAt: string | null
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
  maxUsesPerClient: number | null
  active: boolean
  createdAt: string
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  type: 'percent',
  value: '',
  minAmount: '',
  startsAt: '',
  expiresAt: '',
  maxUses: '',
  maxUsesPerClient: '',
  active: true,
}

function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const fetchCoupons = useCallback(() => {
    fetch('/api/boutique/admin/coupons')
      .then(r => r.json())
      .then(data => setCoupons(data.coupons || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const resetForm = () => {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (c: Coupon) => {
    setForm({
      code: c.code,
      name: c.name,
      description: c.description || '',
      type: c.type,
      value: String(c.value),
      minAmount: c.minAmount ? String(c.minAmount) : '',
      startsAt: c.startsAt ? c.startsAt.slice(0, 10) : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      maxUsesPerClient: c.maxUsesPerClient != null ? String(c.maxUsesPerClient) : '',
      active: c.active,
    })
    setEditingId(c.id)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.code || !form.name) {
      toast.error('Code et nom requis')
      return
    }
    const valueNum = parseFloat(form.value)
    if (isNaN(valueNum) || valueNum <= 0) {
      toast.error('Valeur de réduction invalide')
      return
    }
    if (form.type === 'percent' && valueNum > 100) {
      toast.error('Le pourcentage ne peut pas dépasser 100%')
      return
    }

    setSaving(true)
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      value: valueNum,
      minAmount: form.minAmount ? parseFloat(form.minAmount) : 0,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      maxUsesPerClient: form.maxUsesPerClient ? parseInt(form.maxUsesPerClient) : null,
      active: form.active,
    }

    try {
      const url = editingId
        ? `/api/boutique/admin/coupons/${editingId}`
        : '/api/boutique/admin/coupons'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        return
      }
      toast.success(editingId ? 'Coupon mis à jour' : 'Coupon créé')
      resetForm()
      fetchCoupons()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (c: Coupon) => {
    const res = await fetch(`/api/boutique/admin/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    if (res.ok) {
      toast.success(c.active ? 'Coupon désactivé' : 'Coupon activé')
      fetchCoupons()
    } else {
      toast.error('Erreur')
    }
  }

  const remove = async (c: Coupon) => {
    if (!confirm(`Supprimer le coupon "${c.code}" ?`)) return
    const res = await fetch(`/api/boutique/admin/coupons/${c.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Coupon supprimé')
      fetchCoupons()
    } else {
      toast.error('Erreur')
    }
  }

  const isExpired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date()
  const isUpcoming = (c: Coupon) => c.startsAt && new Date(c.startsAt) > new Date()
  const isExhausted = (c: Coupon) => c.maxUses != null && c.usedCount >= c.maxUses

  if (loading) return <Skeleton className="h-32" />

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200">
        🎟️ <strong>Coupons de réduction :</strong> créez des codes (% ou montant fixe) que vos clients saisissent sur la page de paiement. Vous pouvez limiter dans le temps, par montant minimum de panier, et par nombre d'utilisations.
      </div>

      {/* Coupons list */}
      {coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Aucun coupon pour le moment. Cliquez sur « Nouveau coupon » pour en créer un.
        </p>
      ) : (
        <div className="space-y-2">
          {coupons.map(c => {
            const expired = isExpired(c)
            const upcoming = isUpcoming(c)
            const exhausted = isExhausted(c)
            return (
              <div key={c.id} className="border rounded-md p-3 bg-card">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    <TicketPercent className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{c.code}</code>
                      <Badge variant="outline" className="text-[10px]">
                        {c.type === 'percent' ? `-${c.value}%` : `-${c.value.toFixed(2)}€`}
                      </Badge>
                      {!c.active && <Badge variant="secondary" className="text-[10px]">Désactivé</Badge>}
                      {expired && <Badge className="bg-red-600 hover:bg-red-600 text-[10px]">Expiré</Badge>}
                      {upcoming && <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px]">À venir</Badge>}
                      {exhausted && <Badge className="bg-orange-600 hover:bg-orange-600 text-[10px]">Épuisé</Badge>}
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                      {c.minAmount > 0 && <span>Min. panier : <strong>{c.minAmount.toFixed(2)} €</strong></span>}
                      {c.startsAt && <span>Du : {formatDate(c.startsAt)}</span>}
                      {c.expiresAt && <span>Au : {formatDate(c.expiresAt)}</span>}
                      <span>Utilisé : <strong>{c.usedCount}</strong>{c.maxUses != null ? ` / ${c.maxUses}` : ''}</span>
                      {c.maxUsesPerClient != null && <span>Max/client : {c.maxUsesPerClient}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                      {c.active ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form */}
      {showForm ? (
        <div className="border rounded-md p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-semibold">
            {editingId ? 'Modifier le coupon' : 'Nouveau coupon'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Code coupon *</Label>
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER25"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Sera saisi par le client (en majuscules).</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nom interne *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Promo été 2026"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Description (optionnel)</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Remise pour les ventes estivales"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type de remise</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed">Montant fixe (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Valeur {form.type === 'percent' ? '(%)' : '(€)'} *
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.value}
                onChange={e => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'percent' ? '25' : '10'}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Montant min. panier (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.minAmount}
                onChange={e => setForm({ ...form, minAmount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Utilisations max (global)</Label>
              <Input
                type="number"
                min="0"
                value={form.maxUses}
                onChange={e => setForm({ ...form, maxUses: e.target.value })}
                placeholder="illimité"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date de début</Label>
              <Input
                type="date"
                value={form.startsAt}
                onChange={e => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date d'expiration</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Utilisations max par client</Label>
              <Input
                type="number"
                min="0"
                value={form.maxUsesPerClient}
                onChange={e => setForm({ ...form, maxUsesPerClient: e.target.value })}
                placeholder="illimité"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-1">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label className="text-xs cursor-pointer">Coupon actif (visible par les clients)</Label>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={resetForm}>Annuler</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingId ? 'Mettre à jour' : 'Créer le coupon'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau coupon
        </Button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 9 — PARTAGE (Share with friends)
// ═══════════════════════════════════════════════════════════════════════════

interface ShareReferral {
  id: string
  friendEmail: string
  senderEmail: string | null
  senderName: string | null
  productSku: string
  productBrand: string
  productTitle: string | null
  sentAt: string
  createdAt: string
}

function ShareTab() {
  const [referrals, setReferrals] = useState<ShareReferral[]>([])
  const [stats, setStats] = useState({ total: 0, uniqueEmails: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState({
    shareEnabled: true,
    shareColor: '#007bff',
    shareCollectEmails: true,
    shareSiteUrl: '',
    shareSubject: 'Un ami vous recommande cet article',
    shareMessage: 'Bonjour,\n\nJ\'ai trouvé cet article sur {SITE_NAME} et j\'ai pensé qu\'il pourrait vous plaire.\n\nDécouvrez-le ici : {URL}',
    shareButtonText: 'Partager cet article',
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const fetchReferrals = useCallback(() => {
    setLoading(true)
    const url = `/api/boutique/admin/share/emails${search ? `?search=${encodeURIComponent(search)}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setReferrals(data.referrals || [])
        setStats(data.stats || { total: 0, uniqueEmails: 0 })
      })
      .finally(() => setLoading(false))
  }, [search])

  const fetchSettings = useCallback(() => {
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => {
        setSettings({
          shareEnabled: data.shareEnabled !== false,
          shareColor: data.shareColor || '#007bff',
          shareCollectEmails: data.shareCollectEmails !== false,
          shareSiteUrl: data.shareSiteUrl || '',
          shareSubject: data.shareSubject || 'Un ami vous recommande cet article',
          shareMessage: data.shareMessage || 'Bonjour,\n\nJ\'ai trouvé cet article sur {SITE_NAME} et j\'ai pensé qu\'il pourrait vous plaire.\n\nDécouvrez-le ici : {URL}',
          shareButtonText: data.shareButtonText || 'Partager cet article',
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchReferrals(); fetchSettings() }, [fetchReferrals, fetchSettings])

  const removeReferral = async (id: string) => {
    if (!confirm('Supprimer cet email collecté ?')) return
    const res = await fetch(`/api/boutique/admin/share/emails?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Supprimé')
      fetchReferrals()
    } else {
      toast.error('Erreur')
    }
  }

  const exportCsv = () => {
    const csv = ['friendEmail,senderName,senderEmail,productSku,productBrand,createdAt']
    for (const r of referrals) {
      csv.push([
        r.friendEmail,
        `"${(r.senderName || '').replace(/"/g, '""')}"`,
        r.senderEmail || '',
        r.productSku,
        `"${r.productBrand.replace(/"/g, '""')}"`,
        new Date(r.createdAt).toISOString(),
      ].join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emails-partage-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${referrals.length} emails exportés`)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Paramètres sauvegardés')
      setShowSettings(false)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
        🎁 <strong>Module Partage :</strong> vos clients peuvent recommander un article à un ami depuis la page produit.
        Les emails des amis sont collectés ici si l'option est activée.
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Partages envoyés</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Emails uniques collectés</p>
            <p className="text-2xl font-bold mt-1">{stats.uniqueEmails}</p>
          </CardContent>
        </Card>
      </div>

      {/* Settings + export buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <Share2 className="h-4 w-4 mr-1" /> {showSettings ? 'Fermer' : 'Paramètres du module'}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={referrals.length === 0}>
          <FileText className="h-4 w-4 mr-1" /> Exporter CSV
        </Button>
        <Button variant="outline" size="sm" onClick={fetchReferrals}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Paramètres du partage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.shareEnabled}
                onCheckedChange={v => setSettings({ ...settings, shareEnabled: v })}
              />
              <Label className="text-sm cursor-pointer">Activer le module de partage (bouton sur la page produit)</Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={settings.shareCollectEmails}
                onCheckedChange={v => setSettings({ ...settings, shareCollectEmails: v })}
              />
              <Label className="text-sm cursor-pointer">
                Collecter les emails des amis dans ce tableau (désactivé = aucune collecte, juste envoi de l'email)
              </Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">URL de la boutique (pour les emails de partage)</Label>
              <Input
                type="url"
                value={settings.shareSiteUrl}
                onChange={e => setSettings({ ...settings, shareSiteUrl: e.target.value })}
                placeholder="https://junashop.fr"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                URL absolue utilisée dans les emails envoyés aux amis. Laisser vide = détection automatique (peut être incorrecte en localhost).
                Sans slash final. Exemple : <code>https://junashop.fr</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Couleur d'accent (header + bouton)</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.shareColor}
                    onChange={e => setSettings({ ...settings, shareColor: e.target.value })}
                    className="w-16 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.shareColor}
                    onChange={e => setSettings({ ...settings, shareColor: e.target.value })}
                    placeholder="#007bff"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Texte du bouton</Label>
                <Input
                  value={settings.shareButtonText}
                  onChange={e => setSettings({ ...settings, shareButtonText: e.target.value })}
                  placeholder="Partager cet article"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sujet de l'email</Label>
              <Input
                value={settings.shareSubject}
                onChange={e => setSettings({ ...settings, shareSubject: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">Variables disponibles : {'{SITE_NAME}, {URL}, {BRAND}, {TITLE}'}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Message de l'email</Label>
              <Textarea
                value={settings.shareMessage}
                onChange={e => setSettings({ ...settings, shareMessage: e.target.value })}
                rows={5}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Variables : {'{SITE_NAME}, {URL}, {BRAND}, {TITLE}'}. Le lien vers l'article est automatiquement ajouté.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowSettings(false); fetchSettings() }}>Annuler</Button>
              <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Sauvegarder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Input
        placeholder="Rechercher par email, marque, SKU..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') fetchReferrals() }}
        className="max-w-md"
      />

      {/* Referrals table */}
      {loading ? (
        <Skeleton className="h-32" />
      ) : referrals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Aucun email collecté pour le moment. Les emails apparaîtront ici quand des visiteurs utiliseront le bouton "Partager" sur la boutique.
        </p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left text-[10px] text-muted-foreground uppercase border-b">
                <th className="px-3 py-2 font-medium">Email ami</th>
                <th className="px-3 py-2 font-medium">Expéditeur</th>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-[11px]">{r.friendEmail}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.senderName ? (
                      <span>{r.senderName}{r.senderEmail ? <span className="block text-[10px]">{r.senderEmail}</span> : null}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.productBrand}</span>
                    <span className="block text-[10px] text-muted-foreground font-mono">{r.productSku}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" className="text-red-600 h-7 w-7 p-0" onClick={() => removeReferral(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 10 — NEWSLETTER
// ═══════════════════════════════════════════════════════════════════════════

interface NewsletterSubscriber {
  id: string
  email: string
  active: boolean
  source: string
  createdAt: string
}

function NewsletterTab() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  const [settings, setSettings] = useState({
    newsletterEnabled: false,
    newsletterTitle: 'Newsletter',
    newsletterSubtitle: 'Recevez nos nouveautés et offres exclusives',
    newsletterButtonText: "S'inscrire",
    newsletterPlaceholder: 'Votre adresse email',
    newsletterSuccessMessage: "Merci ! Vous êtes maintenant inscrit(e) à notre newsletter.",
    newsletterColor: '#007bff',
  })

  const fetchSubscribers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filter !== 'all') params.set('filter', filter)
    fetch(`/api/boutique/admin/newsletter/subscribers?${params}`)
      .then(r => r.json())
      .then(data => {
        setSubscribers(data.subscribers || [])
        setStats(data.stats || { total: 0, active: 0 })
      })
      .finally(() => setLoading(false))
  }, [search, filter])

  const fetchSettings = useCallback(() => {
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => {
        setSettings({
          newsletterEnabled: data.newsletterEnabled === true,
          newsletterTitle: data.newsletterTitle || 'Newsletter',
          newsletterSubtitle: data.newsletterSubtitle || 'Recevez nos nouveautés et offres exclusives',
          newsletterButtonText: data.newsletterButtonText || "S'inscrire",
          newsletterPlaceholder: data.newsletterPlaceholder || 'Votre adresse email',
          newsletterSuccessMessage: data.newsletterSuccessMessage || "Merci ! Vous êtes maintenant inscrit(e) à notre newsletter.",
          newsletterColor: data.newsletterColor || '#007bff',
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchSubscribers(); fetchSettings() }, [fetchSubscribers, fetchSettings])

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/boutique/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Paramètres sauvegardés')
      setShowSettings(false)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSavingSettings(false)
    }
  }

  const addManual = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Email invalide')
      return
    }
    const res = await fetch('/api/boutique/admin/newsletter/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail.trim() }),
    })
    if (res.ok) {
      toast.success('Abonné ajouté')
      setNewEmail('')
      fetchSubscribers()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Erreur')
    }
  }

  const toggleActive = async (s: NewsletterSubscriber) => {
    await fetch(`/api/boutique/admin/newsletter/subscribers/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !s.active }),
    })
    toast.success(s.active ? 'Désactivé' : 'Activé')
    fetchSubscribers()
  }

  const remove = async (s: NewsletterSubscriber) => {
    if (!confirm(`Supprimer ${s.email} ?`)) return
    await fetch(`/api/boutique/admin/newsletter/subscribers/${s.id}`, { method: 'DELETE' })
    toast.success('Supprimé')
    fetchSubscribers()
  }

  const exportCsv = () => {
    const csv = subscribers.map(s => s.email).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter-abonnes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${subscribers.length} emails exportés`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
        📧 <strong>Module Newsletter :</strong> vos clients peuvent s'inscrire à la newsletter depuis la page d'accueil de la boutique. Les emails sont collectés ici.
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total abonnés</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Abonnés actifs</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.active}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <MailOpen className="h-4 w-4 mr-1" /> {showSettings ? 'Fermer' : 'Paramètres'}
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={subscribers.length === 0}>
          <FileText className="h-4 w-4 mr-1" /> Exporter CSV
        </Button>
        <Button variant="outline" size="sm" onClick={fetchSubscribers}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MailOpen className="h-4 w-4" /> Paramètres de la newsletter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.newsletterEnabled}
                onCheckedChange={v => setSettings({ ...settings, newsletterEnabled: v })}
              />
              <Label className="text-sm cursor-pointer">Afficher le formulaire d'inscription sur la boutique</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Titre</Label>
                <Input value={settings.newsletterTitle} onChange={e => setSettings({ ...settings, newsletterTitle: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Couleur d'accent</Label>
                <div className="flex gap-2">
                  <Input type="color" value={settings.newsletterColor} onChange={e => setSettings({ ...settings, newsletterColor: e.target.value })} className="w-16 h-9 p-1 cursor-pointer" />
                  <Input value={settings.newsletterColor} onChange={e => setSettings({ ...settings, newsletterColor: e.target.value })} className="flex-1 font-mono text-xs" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sous-titre</Label>
              <Input value={settings.newsletterSubtitle} onChange={e => setSettings({ ...settings, newsletterSubtitle: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Texte du bouton</Label>
                <Input value={settings.newsletterButtonText} onChange={e => setSettings({ ...settings, newsletterButtonText: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Placeholder du champ email</Label>
                <Input value={settings.newsletterPlaceholder} onChange={e => setSettings({ ...settings, newsletterPlaceholder: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Message de succès</Label>
              <Textarea value={settings.newsletterSuccessMessage} onChange={e => setSettings({ ...settings, newsletterSuccessMessage: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowSettings(false); fetchSettings() }}>Annuler</Button>
              <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Sauvegarder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual add */}
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Ajouter manuellement un email…"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={addManual}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Rechercher un email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fetchSubscribers() }}
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscribers table */}
      {loading ? (
        <Skeleton className="h-32" />
      ) : subscribers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Aucun abonné pour le moment. Les emails apparaîtront ici quand des visiteurs s'inscriront depuis la boutique.
        </p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left text-[10px] text-muted-foreground uppercase border-b">
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-[11px]">{s.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px]">{s.source}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {s.active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">Actif</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(s)}>
                        {s.active ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 h-7 w-7 p-0" onClick={() => remove(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Campagnes ── */}
      <div className="pt-4 border-t">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Send className="h-4 w-4" /> Campagnes d'envoi
        </h3>
        <NewsletterCampaignsSection />
      </div>
    </div>
  )
}

// Section Campagnes

interface Campaign {
  id: string
  name: string
  subject: string
  htmlContent: string
  status: string
  scheduledAt: string | null
  sentAt: string | null
  recipientsCount: number
  sentCount: number
  failCount: number
  createdAt: string
}

function NewsletterCampaignsSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', htmlContent: '', scheduledAt: '' })

  const fetchCampaigns = useCallback(() => {
    setLoading(true)
    fetch('/api/boutique/admin/newsletter/campaigns')
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const resetForm = () => { setForm({ name: '', subject: '', htmlContent: '', scheduledAt: '' }); setEditing(null); setShowForm(false); setPreviewMode(false) }

  const startEdit = (c: Campaign) => {
    setForm({ name: c.name, subject: c.subject, htmlContent: c.htmlContent, scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : '' })
    setEditing(c); setShowForm(true)
  }

  const save = async () => {
    if (!form.name || !form.subject || !form.htmlContent) { toast.error('Nom, sujet et contenu requis'); return }
    setSending('saving')
    try {
      const url = editing ? `/api/boutique/admin/newsletter/campaigns/${editing.id}` : '/api/boutique/admin/newsletter/campaigns'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Erreur') }
      toast.success(editing ? 'Campagne modifiée' : 'Campagne créée'); resetForm(); fetchCampaigns()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') } finally { setSending(null) }
  }

  const sendNow = async (c: Campaign) => {
    if (!confirm(`Envoyer "${c.subject}" à TOUS les abonnés actifs maintenant ?`)) return
    setSending(c.id)
    try {
      const res = await fetch(`/api/boutique/admin/newsletter/campaigns/${c.id}/send`, { method: 'POST' })
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`Envoyé : ${data.sentCount} succès, ${data.failCount} échecs sur ${data.total}`); fetchCampaigns()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erreur') } finally { setSending(null) }
  }

  const cancelScheduled = async (c: Campaign) => {
    await fetch(`/api/boutique/admin/newsletter/campaigns/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
    toast.success('Campagne annulée'); fetchCampaigns()
  }

  const removeCampaign = async (c: Campaign) => {
    if (!confirm(`Supprimer la campagne "${c.name}" ?`)) return
    await fetch(`/api/boutique/admin/newsletter/campaigns/${c.id}`, { method: 'DELETE' })
    toast.success('Supprimée'); fetchCampaigns()
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
    scheduled: { label: 'Programmée', color: 'bg-amber-100 text-amber-700' },
    sending: { label: 'Envoi en cours', color: 'bg-blue-100 text-blue-700' },
    sent: { label: 'Envoyée', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
  }

  return (
    <div className="space-y-3">
      {loading ? <Skeleton className="h-20" /> : campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucune campagne. Cliquez sur « Nouvelle campagne » pour créer votre première newsletter.</p>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => {
            const st = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-muted' }
            return (
              <div key={c.id} className="border rounded-md p-3 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <Badge className={cn('text-[10px]', st.color)}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Sujet : <strong>{c.subject}</strong></p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      {c.scheduledAt && <span>Programmée : {formatDate(c.scheduledAt)} {new Date(c.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                      {c.sentAt && <span>Envoyée : {formatDate(c.sentAt)} {new Date(c.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                      {c.status === 'sent' && <span>✅ {c.sentCount} envoyés · ❌ {c.failCount} échecs · 📧 {c.recipientsCount} destinataires</span>}
                      {!c.sentAt && !c.scheduledAt && <span>Créée : {formatDate(c.createdAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(c.status === 'draft' || c.status === 'scheduled') && (
                      <Button size="sm" variant="outline" onClick={() => sendNow(c)} disabled={sending === c.id}>
                        {sending === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Envoyer
                      </Button>
                    )}
                    {c.status === 'draft' && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(c)}><Edit className="h-3.5 w-3.5" /></Button>
                    )}
                    {c.status === 'scheduled' && (
                      <Button size="sm" variant="ghost" className="text-amber-600 h-8" onClick={() => cancelScheduled(c)}>Annuler</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-600 h-8 w-8 p-0" onClick={() => removeCampaign(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm ? (
        <div className="border rounded-md p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{editing ? 'Modifier la campagne' : 'Nouvelle campagne'}</p>
            <div className="flex gap-2">
              <Button size="sm" variant={previewMode ? 'outline' : 'default'} onClick={() => setPreviewMode(false)}>Éditer</Button>
              <Button size="sm" variant={previewMode ? 'default' : 'outline'} onClick={() => setPreviewMode(true)}>Aperçu</Button>
            </div>
          </div>
          {previewMode ? (
            <div className="border rounded-md overflow-hidden bg-white">
              <div className="bg-[#007bff] text-white p-4 text-center font-semibold text-sm">Newsletter</div>
              <div className="p-4 max-h-[400px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: form.htmlContent || '<p class="text-gray-400 text-center">Aucun contenu</p>' }} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Nom interne *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Promo été 2026" /></div>
                <div className="space-y-1"><Label className="text-xs">Sujet de l'email *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="🤑 -20% sur toute la boutique !" /></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contenu HTML *</Label>
                <Textarea value={form.htmlContent} onChange={e => setForm({ ...form, htmlContent: e.target.value })} placeholder="<h2>Offres exclusives</h2><p>Découvrez nos nouveautés...</p>" rows={10} className="font-mono text-xs resize-y" />
                <p className="text-[10px] text-muted-foreground">Code HTML libre. Le contenu sera inséré dans un template email avec en-tête coloré et lien de désinscription.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date d'envoi programmée (laisser vide = brouillon)</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
                <p className="text-[10px] text-muted-foreground">Pour envoyer maintenant, laissez vide et cliquez sur « Créer » puis « Envoyer » depuis la liste. Pour programmer, choisissez une date.</p>
              </div>
            </>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={resetForm}>Annuler</Button>
            <Button size="sm" onClick={save} disabled={sending === 'saving'}>{sending === 'saving' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{editing ? 'Modifier' : 'Créer'}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setShowForm(true) }}><Plus className="h-4 w-4 mr-1" /> Nouvelle campagne</Button>
      )}

      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-[11px] text-amber-800 dark:text-amber-200">
        ⏰ <strong>Envoi programmé :</strong> configurez un cron job qui appelle <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">https://junashop.fr/api/cron/newsletter-send</code> toutes les 5-15 min. Crontab : <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">*/10 * * * * curl -s https://junashop.fr/api/cron/newsletter-send</code>
      </div>
    </div>
  )
}
// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 11 — ALERTES STOCK ("M'alerter quand ce produit est de retour en stock")
// ═══════════════════════════════════════════════════════════════════════════

interface StockAlert {
  id: string
  email: string
  stockItemId: string
  productSku: string
  productBrand: string
  productTitle: string | null
  productPhoto: string | null
  status: string  // pending | notified | cancelled
  notifiedAt: string | null
  createdAt: string
}

function StockAlertsTab() {
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, notified: 0, uniqueEmails: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'notified'>('all')

  const fetchAlerts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('search', search)
    fetch(`/api/boutique/admin/stock-alerts?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setAlerts(data.alerts || [])
        setStats(data.stats || { total: 0, pending: 0, notified: 0, uniqueEmails: 0 })
      })
      .catch(() => {
        toast.error('Erreur lors du chargement')
      })
      .finally(() => setLoading(false))
  }, [statusFilter, search])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const removeAlert = async (id: string) => {
    if (!confirm('Supprimer cette alerte ?')) return
    const res = await fetch(`/api/boutique/admin/stock-alerts?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Alerte supprimée')
      fetchAlerts()
    } else {
      toast.error('Erreur')
    }
  }

  const exportCsv = () => {
    const csv = ['email,productSku,productBrand,productTitle,status,createdAt,notifiedAt']
    for (const a of alerts) {
      csv.push([
        a.email,
        a.productSku,
        `"${a.productBrand.replace(/"/g, '""')}"`,
        `"${(a.productTitle || '').replace(/"/g, '""')}"`,
        a.status,
        new Date(a.createdAt).toISOString(),
        a.notifiedAt ? new Date(a.notifiedAt).toISOString() : '',
      ].join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `alertes-stock-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`${alerts.length} alertes exportées`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
        <BellRing className="h-4 w-4 inline mr-1" />
        <strong>Module Alerte stock :</strong> sur la page boutique, quand un article est en rupture, un bouton "M'alerter quand ce produit est de retour en stock" permet au visiteur de laisser son email. Dès que vous remettez du stock sur l'article (statut PUBLIE + quantité &gt; 0), un email HTML est automatiquement envoyé à tous les inscrits.
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total alertes</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">En attente</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Notifiés</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.notified}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Emails uniques</p>
            <p className="text-2xl font-bold mt-1">{stats.uniqueEmails}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="notified">Notifiés</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Rechercher par email, marque, SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fetchAlerts() }}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={fetchAlerts}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={alerts.length === 0}>
          <FileText className="h-4 w-4 mr-1" /> Exporter CSV
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-32" />
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <BellRing className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Aucune alerte pour le moment</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les visiteurs qui cliquent sur "M'alerter" apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left text-[10px] text-muted-foreground uppercase border-b">
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Souscription</th>
                <th className="px-3 py-2 font-medium">Notifié le</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-[11px] break-all">{a.email}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {a.productPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.productPhoto} alt="" className="h-9 w-9 rounded object-cover bg-muted" />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.productBrand}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {a.productTitle || '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">{a.productSku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {a.status === 'pending' && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">En attente</Badge>
                    )}
                    {a.status === 'notified' && (
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">Notifié</Badge>
                    )}
                    {a.status === 'cancelled' && (
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Annulé</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(a.createdAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.notifiedAt ? formatDate(a.notifiedAt) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" className="text-red-600 h-7 w-7 p-0" onClick={() => removeAlert(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
