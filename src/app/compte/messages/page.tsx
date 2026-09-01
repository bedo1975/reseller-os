'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, ChevronRight, Mail, Shield, Bold, Italic, Underline, List, ListOrdered } from 'lucide-react'


import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'


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

  const [rgpdAccepted, setRgpdAccepted] = useState(false)
  const [rgpdPopupOpen, setRgpdPopupOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)


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
      
    if (!rgpdAccepted) {
      alert('Vous devez accepter la politique de confidentialité pour envoyer un message.')
      return
    }

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
       
      setRgpdAccepted(false)
      
      fetchMessages()
    } catch {
      alert('Erreur réseau')
    } finally {
      setSending(false)
    }
  }

    const wrapSelection = (before: string, after: string = before) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const text = form.body
    const selected = text.substring(start, end) || ''
    const newText = text.substring(0, start) + before + selected + after + text.substring(end)
    setForm({ ...form, body: newText })
    setTimeout(() => { ta.focus(); ta.selectionStart = start + before.length; ta.selectionEnd = end + before.length }, 0)
  }

  const insertLinePrefix = (prefix: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const text = form.body
    let lineStart = start
    while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--
    const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart)
    setForm({ ...form, body: newText })
    setTimeout(() => { ta.focus(); ta.selectionStart = start + prefix.length; ta.selectionEnd = end + prefix.length }, 0)
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
                    {m.fromClient ? 'Vous' : 'Junashop'}
                    {m.subject && ` · ${m.subject}`}
                  </p>
                 {/* <p className="text-sm whitespace-pre-wrap">{m.body}</p> */}
                  <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: m.body.replace(/\n/g, '<br>') }} />
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
      
      
      {/*}  <div className="space-y-1.5">
          <Label className="text-xs">Message</Label>
          <Textarea
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            rows={3}
            placeholder="Votre message..."
          />
        </div> */}

                <div className="space-y-1.5">
          <Label className="text-xs">Message</Label>
          <div className="flex items-center gap-1 border border-b-0 border-gray-300 rounded-t-md px-2 py-1 bg-gray-50">
            <button type="button" onClick={() => wrapSelection('<strong>', '</strong>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Gras"><Bold className="h-4 w-4" /></button>
            <button type="button" onClick={() => wrapSelection('<em>', '</em>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Italique"><Italic className="h-4 w-4" /></button>
            <button type="button" onClick={() => wrapSelection('<u>', '</u>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Souligné"><Underline className="h-4 w-4" /></button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button type="button" onClick={() => insertLinePrefix('• ')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Liste à puces"><List className="h-4 w-4" /></button>
            <button type="button" onClick={() => insertLinePrefix('1. ')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Liste numérotée"><ListOrdered className="h-4 w-4" /></button>
          </div>
          <Textarea
            ref={textareaRef}
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            rows={4}
            placeholder="Votre message..."
            className="rounded-t-none"
          />
        </div>
      
      
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={rgpdAccepted} onChange={e => setRgpdAccepted(e.target.checked)} className="rounded mt-0.5 shrink-0" />
            <span>
              J'accepte que mon message et mes données soient traités conformément à la{' '}
              <button type="button" onClick={() => setRgpdPopupOpen(true)} className="text-[#007bff] underline inline-flex items-center gap-0.5">
                <Shield className="h-3 w-3" /> politique de confidentialité
              </button>{' '}et au RGPD.
            </span>
          </label>
        </div>

        <div className="flex justify-end">
                  <Button onClick={send} disabled={sending || !form.subject.trim() || !form.body.trim() || !rgpdAccepted} className="bg-[#007bff] hover:bg-[#0056b3]">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Envoyer
          </Button>
        </div>
      </div>
         <Dialog open={rgpdPopupOpen} onOpenChange={setRgpdPopupOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#007bff]" />
              Protection de vos données — RGPD
            </DialogTitle>
            <DialogDescription>Informations sur le traitement de vos données dans la messagerie</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600 py-2">
            <p><strong>Messagerie interne :</strong> les messages sont visibles par notre équipe pour répondre à vos questions.</p>
            <p><strong>Données stockées :</strong> prénom, nom, email + contenu des messages (2 ans après le dernier échange).</p>
            <p><strong>Transfert :</strong> vos messages ne sont jamais transmis à des tiers.</p>
            <p><strong>Vos droits :</strong> accès, rectification, effacement. Contactez-nous par email.</p>
            <div className="pt-2 border-t">
              <Link href="/politique-confidentialite" target="_blank" className="text-[#007bff] underline font-medium">
                Politique de confidentialité complète →
              </Link>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setRgpdPopupOpen(false)}>Fermer</Button>
            <Button size="sm" onClick={() => { setRgpdAccepted(true); setRgpdPopupOpen(false) }} className="bg-[#007bff]">J'accepte</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
