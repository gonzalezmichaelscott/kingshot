// @ts-nocheck
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Home, Users, Calendar, MessageSquare, BarChart3,
  Shield, Settings, Crown, Menu, X, LogOut, Sword, Timer
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { isBackendRole } from '@/lib/access'
import { ChatPanel } from '@/components/chat/ChatPanel'

interface SidebarProps {
  allianceId?: string
  role?: string | null
  userId?: string
  allianceName?: string
}

export function Sidebar({ allianceId, role, userId, allianceName }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const allianceBase = allianceId ? `/alliances/${allianceId}` : null

  // Only R4/R5/system_admin get backend navigation; R3 and below see Dashboard only
  const backend = isBackendRole(role)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    ...(backend ? [{ href: '/kingdoms', label: 'Kingdoms', icon: Crown }] : []),
    ...(backend && allianceBase ? [
      { href: `${allianceBase}`, label: 'Alliance Hub', icon: Shield },
      { href: `${allianceBase}/members`, label: 'Members', icon: Users },
      { href: `${allianceBase}/events`, label: 'Events', icon: Calendar },
      { href: `${allianceBase}/chat`, label: 'Chat', icon: MessageSquare },
      { href: `${allianceBase}/board`, label: 'Board', icon: MessageSquare },
      { href: `${allianceBase}/analytics`, label: 'Analytics', icon: BarChart3 },
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
              onClick={() => { setChatOpen(true); setOpen(false) }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 w-full transition-colors"
            >
              <MessageSquare size={18} className="text-amber-500" />
              Alliance Chat
            </button>
          )}
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
        />
      )}
    </>
  )
}
