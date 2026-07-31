'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

/**
 * Global notifier for staff messages.
 * Place this in the admin layout to poll for new messages every 30s
 * and show a toast notification when a new message arrives.
 * Also updates a global unread count badge on the sidebar.
 */
export function StaffMessageNotifier() {
  const { data: session } = useSession()
  const prevUnreadRef = useRef(-1) // -1 = not initialized yet

  useEffect(() => {
    if (!session?.user) return

    // Initial fetch to set baseline
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/staff/messages')
        if (!res.ok) return
        const data = await res.json()
        const newUnread = data.unreadCount || 0

        // Only notify if we have a previous count AND it increased
        if (prevUnreadRef.current >= 0 && newUnread > prevUnreadRef.current) {
          const diff = newUnread - prevUnreadRef.current
          toast.info(`📬 Vous avez ${diff} nouveau(x) message(s) staff !`, {
            duration: 6000,
            action: {
              label: 'Voir',
              onClick: () => {
                window.location.href = '/?module=staff-messaging'
              },
            },
          })
        }

        prevUnreadRef.current = newUnread

        // Update a global event so sidebar badges can react
        window.dispatchEvent(new CustomEvent('staff-messages-update', { detail: { unreadCount: newUnread } }))
      } catch {}
    }

    // Initial fetch after 2s (let the page load first)
    const initialTimer = setTimeout(fetchUnread, 2000)

    // Poll every 30s
    const interval = setInterval(fetchUnread, 30000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [session])

  return null
}
