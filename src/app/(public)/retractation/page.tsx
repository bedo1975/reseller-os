'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronRight, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function RetractationPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', orderId: '', productName: '', reason: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email) { toast.error('Veuillez remplir tous les champs obligatoires'); return }
    setSubmitted(true)
    toast.success('Demande de rétractation envoyée')
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Demande envoyée !</h1>
          <p className="text-gray-600">Votre demande de rétractation a bien été enregistrée. Nous vous contacterons par email dans les plus brefs délais pour organiser le retour.</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">📋 Prochaines étapes :</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Vous disposez de <strong>14 jours</strong> à compter de la réception pour renvoyer le produit</li>
            <li>Les frais de retour sont à votre charge</li>
            <li>Le remboursement sera effectué dans les <strong>14 jours</strong> suivant la réception du retour</li>
            <li>Le produit doit être retourné dans son état d'origine</li>
          </ul>
        </div>
        <div className="text-center mt-6">
          <Link href="/"><Button className="bg-[#007bff] hover:bg-[#0056b3]">Retour à la boutique</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Droit de rétractation</span>
      </nav>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#007bff]/10">
          <RotateCcw className="h-6 w-6 text-[#007bff]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Droit de rétractation</h1>
          <p className="text-sm text-gray-500">Conformément à l'article L221-18 du Code de la consommation</p>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800 space-y-2">
        <p className="font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Informations importantes</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Vous disposez d'un délai de <strong>14 jours</strong> à compter de la réception pour exercer votre droit de rétractation</li>
          <li>Le produit doit être retourné dans son état d'origine, non porté et non lavé</li>
          <li>Les frais de retour sont à votre charge</li>
          <li>Le remboursement sera effectué par le même moyen de paiement, dans un délai de 14 jours</li>
          <li>Les articles soldés ou personnalisés ne sont pas concernés</li>
        </ul>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Formulaire de rétractation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-xs">Prénom *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label className="text-xs">Nom *</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">N° de commande</Label><Input value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })} placeholder="CMD-..." /></div>
        <div className="space-y-1.5"><Label className="text-xs">Produit concerné</Label><Input value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} placeholder="Marque + référence" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Motif (optionnel)</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Indiquez le motif..." rows={3} /></div>
        <div className="flex justify-end"><Button type="submit" className="bg-[#007bff] hover:bg-[#0056b3]"><RotateCcw className="h-4 w-4 mr-2" />Envoyer ma demande</Button></div>
      </form>
    </div>
  )
}
