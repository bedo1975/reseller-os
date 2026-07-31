'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

// Global state for unread message count (shared with sidebar)
let globalUnreadCount = 0
const listeners = new Set<(count: number) => void>()

export function getGlobalUnreadCount() { return globalUnreadCount }
export function subscribeUnreadCount(cb: (count: number) => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function notifyListeners(count: number) {
  globalUnreadCount = count
  listeners.forEach(cb => cb(count))
}

/**
 * Global notifier for staff messages.
 * Polls for new messages every 30s and shows a persistent toast.
 */
export function StaffMessageNotifier() {
  const { data: session } = useSession()
  const prevUnreadRef = useRef(-1)

  useEffect(() => {
    if (!session?.user) return

    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/staff/messages')
        if (!res.ok) return
        const data = await res.json()
        const newUnread = data.unreadCount || 0

        if (prevUnreadRef.current >= 0 && newUnread > prevUnreadRef.current) {
          const diff = newUnread - prevUnreadRef.current
          // Persistent toast (stays until dismissed)
          toast.info(`📬 Vous avez ${diff} nouveau(x) message(s) staff !`, {
            duration: Infinity,
            action: {
              label: 'Voir',
              onClick: () => {
                window.location.href = '/?module=staff-messaging'
              },
            },
          })
        }

        prevUnreadRef.current = newUnread
        notifyListeners(newUnread)
      } catch {}
    }

    const initialTimer = setTimeout(fetchUnread, 2000)
    const interval = setInterval(fetchUnread, 30000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [session])

  return null
}

/**
 * Hook to get the unread message count in any component (e.g. sidebar).
 */
export function useUnreadMessages() {
  const [count, setCount] = useState(globalUnreadCount)
  useEffect(() => {
    const unsub = subscribeUnreadCount(setCount)
    return () => { unsub }
  }, [])
  return count
}
