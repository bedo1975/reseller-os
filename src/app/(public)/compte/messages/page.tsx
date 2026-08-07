'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, ChevronRight, Mail } from 'lucide-react'

interface Message {
  id: string
  fromClient: boolean
  subject: string
  body: string
  read: boolean
  createdAt: string
}

export default function MessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ subject: '', body: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMessages = () => {
    fetch('/api/boutique/client/messages')
      .then(r => {
        if (!r.ok) {
          router.push('/connexion')
          return null
        }
        return r.json()
      })
      .then(data => {
        if (data) {
          setMessages(data.messages || [])
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
        setLoading(false)
      })
      .catch(() => {
        router.push('/connexion')
        setLoading(false)
      })
  }

  useEffect(() => { fetchMessages() }, [router])

  const send = async () => {
    if (!form.subject.trim() || !form.body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/boutique/client/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Erreur')
        setSending(false)
        return
      }
      setForm({ subject: '', body: '' })
      fetchMessages()
    } catch {
      alert('Erreur réseau')
    } finally {
      setSending(false)
    }
  }

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
        <span className="text-gray-900">Messagerie</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Messagerie</h1>
      <p className="text-sm text-gray-500 mb-6">Échangez avec notre équipe (question, retour, SAV...)</p>

      {/* Conversation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 min-h-[300px] max-h-[500px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun message pour le moment</p>
            <p className="text-xs text-gray-400">Posez votre question via le formulaire ci-dessous</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex ${m.fromClient ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    m.fromClient
                      ? 'bg-[#007bff] text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-xs font-semibold mb-1 opacity-80">
                    {m.fromClient ? 'Vous' : 'DBoxPro'}
                    {m.subject && ` · ${m.subject}`}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.fromClient ? 'text-blue-100' : 'text-gray-500'}`}>
                    {new Date(m.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* New message */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Nouveau message</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Sujet</Label>
          <Input
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            placeholder="Question sur ma commande, retour, etc."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Message</Label>
          <Textarea
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            rows={3}
            placeholder="Votre message..."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={send} disabled={sending || !form.subject.trim() || !form.body.trim()} className="bg-[#007bff] hover:bg-[#0056b3]">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  )
}
