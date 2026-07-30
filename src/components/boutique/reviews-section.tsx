'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Star, Loader2, MessageCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  authorName: string
  rating: number
  title: string | null
  comment: string | null
  createdAt: string
}

interface ReviewsSectionProps {
  sku: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const starSize = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={cn(starSize, n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300')}
        />
      ))}
    </div>
  )
}

export function ReviewsSection({ sku }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState({ count: 0, avgRating: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    authorName: '',
    rating: 5,
    title: '',
    comment: '',
  })
  const [hoverRating, setHoverRating] = useState(0)

  const fetchReviews = useCallback(() => {
    fetch(`/api/boutique/products/${encodeURIComponent(sku)}/reviews`)
      .then(r => r.json())
      .then(data => {
        setReviews(data.reviews || [])
        setStats(data.stats || { count: 0, avgRating: 0 })
      })
      .finally(() => setLoading(false))
  }, [sku])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.authorName.trim() || form.authorName.trim().length < 2) {
      toast.error('Veuillez saisir votre nom (2 caractères minimum)')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/boutique/products/${encodeURIComponent(sku)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        return
      }
      toast.success('Merci pour votre avis !')
      setForm({ authorName: '', rating: 5, title: '', comment: '' })
      setShowForm(false)
      fetchReviews()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-8 pt-8 border-t border-gray-200">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Avis clients
      </h2>

      {/* Summary */}
      {stats.count > 0 && (
        <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{stats.avgRating}</p>
            <Stars rating={Math.round(stats.avgRating)} size="lg" />
          </div>
          <div className="border-l border-gray-200 pl-4">
            <p className="text-sm text-gray-600">
              Basé sur <strong>{stats.count}</strong> avis{stats.count > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          Aucun avis pour le moment. Soyez le premier à donner votre avis !
        </p>
      ) : (
        <div className="space-y-4 mb-6">
          {reviews.map(r => (
            <div key={r.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    {r.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.authorName}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(r.createdAt)}</p>
                  </div>
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.title && (
                <p className="text-sm font-semibold text-gray-800 mb-1">{r.title}</p>
              )}
              {r.comment && (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toggle form button */}
      {!showForm && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="border-[#007bff] text-[#007bff] hover:bg-blue-50"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Laisser un avis
        </Button>
      )}

      {/* Review form */}
      {showForm && (
        <form onSubmit={submit} className="mt-4 p-4 border border-gray-200 rounded-lg space-y-4 bg-gray-50">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Votre nom *</Label>
            <Input
              value={form.authorName}
              onChange={e => setForm({ ...form, authorName: e.target.value })}
              placeholder="Jean D."
              maxLength={100}
              required
            />
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <Label className="text-xs">Votre note *</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1"
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition-colors',
                      n <= (hoverRating || form.rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-300 hover:text-gray-400'
                    )}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500">
                {form.rating} / 5
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">Titre (optionnel)</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Très bon produit !"
              maxLength={200}
            />
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <Label className="text-xs">Commentaire (optionnel)</Label>
            <Textarea
              value={form.comment}
              onChange={e => setForm({ ...form, comment: e.target.value })}
              placeholder="Partagez votre expérience avec ce produit..."
              rows={4}
              maxLength={2000}
              className="resize-y"
            />
            <p className="text-[10px] text-gray-400 text-right">{form.comment.length} / 2000</p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Envoi…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-1" /> Publier mon avis</>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
