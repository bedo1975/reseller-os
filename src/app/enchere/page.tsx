'use client'

import { useState, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Gavel, Mail, Send, Loader2, Clock, TrendingUp, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatEUR } from '@/lib/constants'
import Link from 'next/link'

interface ActiveAuction {
  id: string
  sku: string
  brand: string
  title: string | null
  category: string
  mainPhoto: string | null
  startPrice: number
  currentPrice: number
  startsAt: string
  endsAt: string
  increments: number[]
  bidCount: number
  bids: { amount: number; name: string; time: string }[]
  stockItem: {
    size: string | null
    color: string | null
    condition: string | null
    grade: string | null
    description: string | null
    photos: string[]
    quantity: number
  } | null
}

export default function AuctionPage() {
  const { data, loading } = useFetch<{ auction: ActiveAuction | null }>('/api/boutique/auctions/active')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedIncrement, setSelectedIncrement] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [bidding, setBidding] = useState(false)
  const [bidDone, setBidDone] = useState(false)
  const [now, setNow] = useState(Date.now())

  // Update the clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Refresh auction data every 15 seconds
  const { refresh } = useFetch<{ auction: ActiveAuction | null }>('/api/boutique/auctions/active')
  useEffect(() => {
    const interval = setInterval(() => refresh(), 15000)
    return () => clearInterval(interval)
  }, [refresh])

  const auction = data?.auction

  // Countdown timer
  const endsAtMs = auction ? new Date(auction.endsAt).getTime() : 0
  const timeLeft = Math.max(0, endsAtMs - now)
  const hours = Math.floor(timeLeft / (1000 * 60 * 60))
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)
  const isEnded = timeLeft <= 0

  const nextBidAmount = auction
    ? (selectedIncrement !== null
        ? auction.currentPrice + selectedIncrement
        : customAmount ? parseFloat(customAmount) : null)
    : null

  const placeBid = async () => {
    if (!auction) return
    if (!email.trim()) {
      toast.error('Veuillez saisir votre adresse email')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Adresse email invalide')
      return
    }
    let amount: number | null = null
    if (selectedIncrement !== null) {
      amount = auction.currentPrice + selectedIncrement
    } else if (customAmount) {
      amount = parseFloat(customAmount)
    }
    if (amount === null || Number.isNaN(amount) || amount <= auction.currentPrice) {
      toast.error('Montant invalide — doit être supérieur au prix actuel')
      return
    }
    setBidding(true)
    try {
      const res = await fetch('/api/boutique/auctions/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: auction.id,
          bidderEmail: email.trim().toLowerCase(),
          bidderName: name.trim() || null,
          amount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setBidDone(true)
      toast.success(`Enchère placée : ${amount.toFixed(2)} €`)
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBidding(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Gavel className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Aucune enchère en cours</h1>
        <p className="text-gray-500 mb-6">Revenez bientôt pour participer à nos prochaines enchères !</p>
        <Link href="/" className="text-[#007bff] hover:underline">← Retour à la boutique</Link>
      </div>
    )
  }

  const photos = auction.stockItem?.photos?.length ? auction.stockItem.photos : (auction.mainPhoto ? [auction.mainPhoto] : [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Gavel className="h-7 w-7 text-amber-600" /> Enchère en cours
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product photos */}
        <div>
          {photos.length > 0 ? (
            <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <img src={photos[0]} alt={auction.brand} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
              <Package className="h-16 w-16 text-gray-300" />
            </div>
          )}
        </div>

        {/* Auction details */}
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">{auction.brand}</p>
            <h2 className="text-xl font-bold text-gray-900">
              {auction.title || auction.category}
              {auction.stockItem?.size && ` · Taille ${auction.stockItem.size}`}
              {auction.stockItem?.color && ` · ${auction.stockItem.color}`}
            </h2>
            {auction.stockItem?.grade && (
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                Grade {auction.stockItem.grade}
              </span>
            )}
          </div>

          {/* Current price */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-xs text-amber-700 uppercase font-medium">Prix actuel</p>
            <p className="text-4xl font-bold text-amber-600">{formatEUR(auction.currentPrice)}</p>
            <p className="text-xs text-gray-500 mt-1">{auction.bidCount} enchère{auction.bidCount > 1 ? 's' : ''}</p>
          </div>

          {/* Countdown */}
          {!isEnded ? (
            <div className="bg-gray-900 text-white rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400 uppercase mb-2 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Temps restant
              </p>
              <p className="text-3xl font-bold font-mono">
                {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </p>
            </div>
          ) : (
            <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
              <p className="text-lg font-bold text-red-700">Enchère terminée</p>
            </div>
          )}

          {/* Bid form */}
          {!isEnded && (
            <div className="space-y-3">
              {bidDone ? (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-emerald-700">Enchère placée !</p>
                  <p className="text-xs text-emerald-600 mt-1">Vous êtes actuellement le meilleur enchérisseur.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setBidDone(false)}>
                    Enchérir à nouveau
                  </Button>
                </div>
              ) : (
                <>
                  {/* Email + name */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Votre email *"
                        className="pl-9"
                      />
                    </div>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Votre nom (optionnel)"
                    />
                  </div>

                  {/* Increment buttons */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Enchérir de :</p>
                    <div className="grid grid-cols-4 gap-2">
                      {auction.increments.map(inc => (
                        <button
                          key={inc}
                          onClick={() => { setSelectedIncrement(inc); setCustomAmount('') }}
                          className={`rounded-lg border-2 p-2 text-center transition-all ${
                            selectedIncrement === inc
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 hover:border-amber-300'
                          }`}
                        >
                          <p className="text-sm font-bold text-amber-600">+{inc}€</p>
                          <p className="text-[10px] text-gray-500">{(auction.currentPrice + inc).toFixed(2)}€</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom amount */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={customAmount}
                      onChange={e => { setCustomAmount(e.target.value); setSelectedIncrement(null) }}
                      placeholder="Ou montant libre"
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500">€</span>
                  </div>

                  {/* Bid button */}
                  <Button
                    onClick={placeBid}
                    disabled={bidding || !email}
                    className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white gap-2"
                  >
                    {bidding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gavel className="h-5 w-5" />}
                    {nextBidAmount ? `Enchérir ${nextBidAmount.toFixed(2)} €` : 'Enchérir'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bid history */}
      {auction.bids.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Historique des enchères
          </h3>
          <div className="space-y-1">
            {auction.bids.map((bid, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-600">
                  {i === 0 && <span className="text-amber-600 font-semibold mr-2">★ Meilleure</span>}
                  {bid.name || 'Anonyme'}
                </span>
                <span className="font-semibold">{bid.amount.toFixed(2)} €</span>
                <span className="text-xs text-gray-400">
                  {new Date(bid.time).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
