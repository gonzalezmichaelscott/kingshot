// @ts-nocheck
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  Home, Users, Calendar, MessageSquare, BarChart3,
  Shield, Settings, Crown, Menu, X, LogOut, Sword, Timer, ShieldCheck,
  CalendarDays, FileText, BookOpen, Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { isBackendRole } from '@/lib/access'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { GoogleTranslate } from '@/components/ui/GoogleTranslate'

interface SidebarProps {
  allianceId?: string
  role?: string | null
  userId?: string
  allianceName?: string
  kingdomId?: string
}

export function Sidebar({ allianceId, role, userId, allianceName, kingdomId }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  // Scroll target for the chat panel when opened from a notification ("Jump to
  // message"). The nonce forces the effect to re-run even for the same message id.
  const [chatTarget, setChatTarget] = useState<{ messageId: string; nonce: number } | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Member roles (R1–R3) jump to a mentioned message via the slide-out panel.
  // The NotificationBell dispatches this event since it lives outside the Sidebar.
  useEffect(() => {
    function onOpenChat(e: Event) {
      const detail = (e as CustomEvent).detail || {}
      setChatOpen(true)
      setOpen(false)
      if (detail.messageId) setChatTarget({ messageId: detail.messageId, nonce: Date.now() })
    }
    window.addEventListener('ks:open-chat', onOpenChat)
    return () => window.removeEventListener('ks:open-chat', onOpenChat)
  }, [])

  const allianceBase = allianceId ? `/alliances/${allianceId}` : null

  // Only R4/R5/system_admin get backend navigation; R3 and below see Dashboard only
  const backend = isBackendRole(role)

  // Pending-approval count for the sidebar badge (Feature 4). Backend roles only.
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const refreshApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals/count', { cache: 'no-store' })
      if (res.ok) { const d = await res.json(); setPendingApprovals(d.count || 0) }
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (!backend) return
    refreshApprovals()
    const channel = supabase
      .channel(`approval-count:${userId || 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_requests' }, () => refreshApprovals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kingdom_creation_requests' }, () => refreshApprovals())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [backend, userId, refreshApprovals])

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    // World Chat — global room open to every logged-in user, any alliance/kingdom.
    { href: '/world-chat', label: 'World Chat', icon: Globe },
    ...(backend ? [{ href: '/kingdoms', label: 'Kingdoms', icon: Crown }] : []),
    ...(backend && allianceBase ? [
      { href: `${allianceBase}`, label: 'Alliance Hub', icon: Shield },
      { href: `${allianceBase}/members`, label: 'Members', icon: Users },
      { href: `${allianceBase}/events`, label: 'Events', icon: Calendar },
      { href: `${allianceBase}/calendar`, label: 'Calendar', icon: CalendarDays },
      { href: `${allianceBase}/templates`, label: 'Templates', icon: FileText },
      { href: `${allianceBase}/board`, label: 'Board', icon: MessageSquare },
      { href: `${allianceBase}/analytics`, label: 'Analytics', icon: BarChart3 },
    ] : []),
    ...(backend && kingdomId ? [
      { href: `/kingdoms/${kingdomId}/kvk`, label: 'KVK Command', icon: Sword },
      // Leadership Chat — kingdom-level room, R4/R5/system_admin only (FIX 4)
      { href: `/kingdoms/${kingdomId}/leadership-chat`, label: 'Leadership Chat', icon: ShieldCheck },
    ] : []),
    ...(backend ? [
      { href: '/guide', label: 'Leader Guide', icon: BookOpen },
    ] : []),
    ...(role === 'system_admin' ? [
      { href: '/admin', label: 'Admin', icon: Settings },
    ] : []),
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      {/* Mobile hamburger — z-[51] keeps it above the clock bar div (z-50) which
           appears later in the DOM and would otherwise paint over this button. */}
      <button
        className="fixed top-3 left-4 z-[51] lg:hidden bg-slate-800 p-2 rounded-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-40 flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <Sword className="text-amber-500" size={24} />
          <span className="font-bold text-lg text-amber-500">Kingshot Hub</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}

          {/* Approvals — R4/R5/system_admin, with pending-count badge */}
          {backend && (
            <Link
              href="/approvals"
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === '/approvals'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <ShieldCheck size={18} />
              <span className="flex-1">Approvals</span>
              {pendingApprovals > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingApprovals > 9 ? '9+' : pendingApprovals}
                </span>
              )}
            </Link>
          )}

          {/* Rally Timer — opens in new tab */}
          <a
            href="/rally-timer"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <Timer size={18} />
            Rally Timer ↗
          </a>
        </nav>

        {/* Bottom: Chat button + Logout */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          {/* Chat button — visible to ALL roles if they have an alliance */}
          {allianceId && userId && (
            <button
              onClick={() => { setChatOpen(o => !o); setOpen(false) }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors ${
                chatOpen ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <MessageSquare size={18} className="text-amber-500" />
              {chatOpen ? 'Close Chat' : 'Alliance Chat'}
            </button>
          )}

          {/* Translate — embedded above Sign out, with a small divider */}
          <div className="pt-1">
            <div className="border-t border-slate-800 mb-2" />
            <GoogleTranslate className="px-3 pb-1" />
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 w-full transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Chat slide-out panel */}
      {allianceId && userId && (
        <ChatPanel
          allianceId={allianceId}
          allianceName={allianceName || 'Alliance'}
          currentUserId={userId}
          currentUserRole={role || ''}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          targetMessageId={chatTarget?.messageId}
          targetNonce={chatTarget?.nonce}
        />
      )}
    </>
  )
}
