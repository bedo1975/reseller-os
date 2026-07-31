'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Mail, Send, Plus, Reply, Loader2, Inbox, CheckCircle2, Users as UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/constants'

interface StaffUser { id: string; name: string; email: string; role: string }

interface Message {
  id: string
  subject: string
  body: string
  isRead: boolean
  readAt: string | null
  createdAt: string
  senderId: string
  recipientId: string
  sender: { id: string; name: string; email: string }
  recipient: { id: string; name: string; email: string } | null
  replies?: Message[]
  parentId?: string | null
}

export function StaffMessagingModule() {
  const { data: session } = useSession()
  const [inbox, setInbox] = useState<Message[]>([])
  const [sent, setSent] = useState<Message[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [showForm, setShowForm] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [recipients, setRecipients] = useState<StaffUser[]>([])
  const [form, setForm] = useState({ recipientId: '', subject: '', body: '' })
  const [sending, setSending] = useState(false)

  const fetchMessages = useCallback(() => {
    fetch('/api/staff/messages')
      .then(r => r.json())
      .then(data => {
        setInbox(data.inbox || [])
        setSent(data.sent || [])
        setUnreadCount(data.unreadCount || 0)
      })
      .finally(() => setLoading(false))
  }, [])

  const fetchRecipients = useCallback(() => {
    fetch('/api/staff/users')
      .then(r => r.json())
      .then(data => setRecipients(data.users || []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchMessages(); fetchRecipients() }, [fetchMessages, fetchRecipients])

  const markAsRead = async (msg: Message) => {
    if (msg.isRead) return
    await fetch(`/api/staff/messages/${msg.id}/read`, { method: 'PATCH' })
    fetchMessages()
  }

  const openMessage = (msg: Message) => {
    setSelectedMessage(msg)
    markAsRead(msg)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.recipientId || !form.subject || !form.body) {
      toast.error('Destinataire, sujet et message requis')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/staff/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: form.recipientId,
          subject: form.subject,
          body: form.body,
          parentId: replyTo?.id || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur')
      }
      toast.success('Message envoyé')
      setForm({ recipientId: '', subject: '', body: '' })
      setShowForm(false)
      setReplyTo(null)
      fetchMessages()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSending(false)
    }
  }

  const startReply = (msg: Message) => {
    setReplyTo(msg)
    setForm({
      recipientId: msg.senderId === session?.user?.id ? (msg.recipientId === 'all' ? 'all' : msg.recipient?.id || '') : msg.senderId,
      subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
      body: '',
    })
    setShowForm(true)
  }

  const messages = tab === 'inbox' ? inbox : sent

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Messagerie interne
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Communiquez avec les autres membres du staff
          </p>
        </div>
        <Button onClick={() => { setReplyTo(null); setForm({ recipientId: '', subject: '', body: '' }); setShowForm(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nouveau message
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('inbox')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
            tab === 'inbox' ? 'border-foreground/30 bg-card shadow-sm' : 'border-border/60 bg-card/50 text-muted-foreground hover:text-foreground'
          )}
        >
          <Inbox className="h-4 w-4" />
          Boîte de réception
          {unreadCount > 0 && <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5">{unreadCount}</Badge>}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all',
            tab === 'sent' ? 'border-foreground/30 bg-card shadow-sm' : 'border-border/60 bg-card/50 text-muted-foreground hover:text-foreground'
          )}
        >
          <Send className="h-4 w-4" />
          Envoyés
        </button>
      </div>

      {/* Message list */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : messages.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun message {tab === 'inbox' ? 'reçu' : 'envoyé'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => (
            <Card key={msg.id} className={cn('cursor-pointer hover:shadow-md transition-shadow', !msg.isRead && tab === 'inbox' && 'border-blue-300 dark:border-blue-800')}>
              <CardContent className="p-4" onClick={() => openMessage(msg)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!msg.isRead && tab === 'inbox' && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      <p className={cn('text-sm', !msg.isRead && tab === 'inbox' ? 'font-bold' : 'font-medium')}>{msg.subject}</p>
                      {msg.recipientId === 'all' && <Badge variant="secondary" className="text-[9px]"><UsersIcon className="h-2.5 w-2.5 mr-0.5" /> Tous</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {tab === 'inbox' ? `De: ${msg.sender.name}` : `À: ${msg.recipientId === 'all' ? 'Tous le staff' : msg.recipient?.name}`}
                      {' · '}<span className="text-muted-foreground/60">{formatDateTime(msg.createdAt)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{msg.body}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); startReply(msg) }}>
                    <Reply className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Message detail dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={(o) => !o && setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
            <DialogDescription>
              De: <strong>{selectedMessage?.sender.name}</strong>
              {' · '}{selectedMessage && formatDateTime(selectedMessage.createdAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">{selectedMessage?.body}</div>

            {/* Replies */}
            {selectedMessage?.replies && selectedMessage.replies.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground uppercase font-medium">Réponses</p>
                {selectedMessage.replies.map(r => (
                  <div key={r.id} className="bg-muted/20 rounded-md p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{r.sender.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => selectedMessage && startReply(selectedMessage)}>
              <Reply className="h-4 w-4 mr-2" /> Répondre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setReplyTo(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{replyTo ? 'Répondre' : 'Nouveau message'}</DialogTitle>
            {replyTo && <DialogDescription>En réponse à: {replyTo.subject}</DialogDescription>}
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Destinataire *</Label>
              <Select value={form.recipientId} onValueChange={v => setForm({ ...form, recipientId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📢 Tous le staff</SelectItem>
                  {recipients.filter(u => u.id !== session?.user?.id).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.role === 'admin' && '👑'} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sujet *</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Sujet du message" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message *</Label>
              <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Votre message…" rows={5} required className="resize-y" />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setShowForm(false); setReplyTo(null) }}>Annuler</Button>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Envoyer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
