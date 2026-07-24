'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Package, Mail, Download } from 'lucide-react'

interface OrderInfo {
  orderId: string
  invoiceNumbers: string[]
  totalAmount: number
  shippingCost: number
  customer: { firstName: string; lastName: string; email: string }
  itemCount: number
}

export default function ConfirmationPage() {
  const [order, setOrder] = useState<OrderInfo | null>(null)

  useEffect(() => {
    try {
      const o = JSON.parse(sessionStorage.getItem('last_order') || 'null')
      setOrder(o)
    } catch {
      setOrder(null)
    }
  }, [])

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">Aucune commande récente à afficher.</p>
        <Link href="/boutique">
          <Button>Retour à la boutique</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Merci pour votre commande !</h1>
        <p className="text-gray-600">
          {order.customer.firstName}, votre commande a bien été enregistrée.
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Un email de confirmation a été envoyé à <strong>{order.customer.email}</strong>
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-500 uppercase">Numéro de commande</p>
            <p className="font-mono font-semibold text-gray-900">{order.orderId}</p>
          </div>
          <Package className="h-8 w-8 text-[#007bff]" />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Articles</span>
            <span className="font-medium">{order.itemCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Livraison</span>
            <span className="font-medium">
              {order.shippingCost === 0 ? 'Gratuite' : `${order.shippingCost.toFixed(2)} €`}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-semibold text-gray-900">Total payé</span>
            <span className="text-lg font-bold text-[#007bff]">{order.totalAmount.toFixed(2)} €</span>
          </div>
        </div>

        {order.invoiceNumbers.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 uppercase mb-2">Facture(s)</p>
            <div className="space-y-2">
              {order.invoiceNumbers.map(n => (
                <a
                  key={n}
                  href={`/api/invoices/by-number/${encodeURIComponent(n)}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#007bff] hover:underline"
                >
                  <Download className="h-4 w-4" />
                  <span className="font-mono">{n}</span>
                  <span className="text-gray-500">— Télécharger la facture (PDF)</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 items-start">
        <Mail className="h-5 w-5 text-[#007bff] shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Prochaines étapes</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>Votre commande est en préparation</li>
            <li>Expédition sous 48h ouvrées</li>
            <li>Vous recevrez un email avec le suivi de colis</li>
          </ul>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link href="/boutique">
          <Button className="bg-[#007bff] hover:bg-[#0056b3]">
            Continuer mes achats
          </Button>
        </Link>
      </div>
    </div>
  )
}
