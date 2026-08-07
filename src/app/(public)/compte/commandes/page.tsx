'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Package, ChevronRight, Truck, FileText, ExternalLink, TicketPercent, CheckCircle2, Clock, PackageCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
  trackingNumber?: string | null
  carrier?: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Payée', color: 'bg-blue-100 text-blue-700' },
  preparation: { label: 'En préparation', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: 'Expédiée', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Livrée', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
}

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  accessoires: 'Accessoires',
  luxe: 'Luxe',
  maison: 'Maison',
}

const CARRIER_LABELS: Record<string, string> = {
  colissimo: 'Colissimo',
  mondial_relay: 'Mondial Relay',
  chronopost: 'Chronopost',
  dhl: 'DHL',
  ups: 'UPS',
  dpd: 'DPD',
  relais_colis: 'Relais Colis',
}

const TRACKING_URLS: Record<string, string> = {
  colissimo: 'https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}',
  mondial_relay: 'https://www.mondialrelay.fr/suivi-de-colis?NumeroExpedition={tracking}',
  chronopost: 'https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT={tracking}',
  dhl: 'https://www.dhl.com/fr/fr/home/tracking/tracking-parcel.html?submit=1&tracking-id={tracking}',
  ups: 'https://www.ups.com/track?tracknum={tracking}',
  dpd: 'https://www.dpd.com/fr/fr/suivre_mon_colonnis/{tracking}',
  relais_colis: 'https://www.relaiscolis.fr/suivi?numExpe={tracking}',
}

export default function MesCommandesPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/boutique/client/orders')
      .then(r => {
        if (!r.ok) {
          router.push('/connexion')
          return null
        }
        return r.json()
      })
      .then(data => {
        if (data) setOrders(data.orders || [])
        setLoading(false)
      })
      .catch(() => {
        router.push('/connexion')
        setLoading(false)
      })
  }, [router])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#007bff] mx-auto" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <Link href="/compte" className="hover:text-[#007bff]">Mon compte</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Mes commandes</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mes commandes</h1>

      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Aucune commande pour le moment</p>
          <p className="text-sm text-gray-400 mb-6">Découvrez nos articles et passez votre première commande !</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-[#007bff] text-white font-medium px-5 py-2 rounded-lg hover:bg-[#0056b3]">
            Voir la boutique
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const status = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' }
            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Commande</p>
                    <p className="font-mono font-semibold text-gray-900">{order.orderId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <Badge className={status.color}>{status.label}</Badge>
                </div>

                {/* Timeline de statut */}
                <div className="flex items-center justify-between mb-4 px-2">
                  {[
                    { key: 'pending', label: 'Reçue', icon: Clock },
                    { key: 'paid', label: 'Payée', icon: CheckCircle2 },
                    { key: 'preparation', label: 'Préparation', icon: PackageCheck },
                    { key: 'shipped', label: 'Expédiée', icon: Truck },
                    { key: 'delivered', label: 'Livrée', icon: Package },
                  ].map((step, i, arr) => {
                    const currentIdx = arr.findIndex(s => s.key === order.status)
                    const stepIdx = i
                    const isDone = currentIdx >= stepIdx
                    const isCancelled = order.status === 'cancelled'
                    const isCurrent = order.status === step.key

                    if (isCancelled) {
                      return (
                        <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-gray-400" />
                          </div>
                          <span className="text-[10px] text-gray-400">{step.label}</span>
                          {i < arr.length - 1 && <div className="hidden">—</div>}
                        </div>
                      )
                    }

                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1 flex-1 relative">
                        {i < arr.length - 1 && (
                          <div className={`absolute top-5 left-1/2 w-full h-0.5 ${isDone && currentIdx > stepIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          isDone ? (isCurrent ? 'bg-[#007bff] text-white ring-4 ring-blue-100' : 'bg-green-500 text-white') : 'bg-gray-200 text-gray-400'
                        }`}>
                          <step.icon className="h-5 w-5" />
                        </div>
                        <span className={`text-[10px] text-center ${isDone ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{step.label}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">{item.brand}</p>
                        <p className="font-medium text-gray-900">
                          {CATEGORY_LABELS[item.category] || item.category}
                          {item.size && ` · Taille ${item.size}`}
                          {item.qty > 1 && ` × ${item.qty}`}
                        </p>
                      </div>
                      <span className="font-medium">{(item.price * item.qty).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Sous-total</span>
                    <span>{order.subtotal.toFixed(2)} €</span>
                  </div>
                  {order.couponCode && order.discountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span className="flex items-center gap-1">
                        <TicketPercent className="h-3.5 w-3.5" />
                        Code promo <code className="font-mono bg-green-50 px-1 py-0.5 rounded">{order.couponCode}</code>
                      </span>
                      <span className="font-medium">−{order.discountAmount.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>{order.shippingMethod}</span>
                    <span>{order.shippingCost === 0 ? 'Gratuit' : `${order.shippingCost.toFixed(2)} €`}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-1 border-t">
                    <span>Total</span>
                    <span className="text-[#007bff]">{order.total.toFixed(2)} €</span>
                  </div>
                </div>

                {/* Tracking info (si expédiée) */}
                {order.status === 'shipped' && order.trackingNumber && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-[#007bff]" />
                      <span className="text-gray-600">Suivi :</span>
                      <span className="font-mono font-medium text-gray-900">{order.trackingNumber}</span>
                      {order.carrier && <Badge variant="outline" className="text-[10px]">{CARRIER_LABELS[order.carrier] || order.carrier}</Badge>}
                    </div>
                    {order.carrier && TRACKING_URLS[order.carrier] && (
                      <a
                        href={TRACKING_URLS[order.carrier].replace('{tracking}', encodeURIComponent(order.trackingNumber))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#007bff] hover:underline mt-1 ml-6"
                      >
                        Suivre mon colis <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Factures cliquables */}
                {order.invoiceNumbers.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 uppercase mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Facture(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {order.invoiceNumbers.map(n => (
                        <a
                          key={n}
                          href={`/api/invoices/by-number/${n}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs bg-blue-50 text-[#007bff] hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                          title="Voir / imprimer la facture"
                        >
                          <FileText className="h-3 w-3" />
                          {n}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
