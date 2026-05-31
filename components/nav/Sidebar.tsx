'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Home, Users, Calendar, MessageSquare, BarChart3,
  Shield, Settings, Crown, Menu, X, LogOut, Sword
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  allianceId?: string
  role?: string | null
}

export function Sidebar({ allianceId, role }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const allianceBase = allianceId ? `/alliances/${allianceId}` : null

  // kingdom_leader and system_admin can browse kingdoms; regular members stay within their alliance
  const canBrowseKingdoms = ['system_admin', 'kingdom_leader', 'r5', 'r4'].includes(role || '')

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    ...(canBrowseKingdoms ? [{ href: '/kingdoms', label: 'Kingdoms', icon: Crown }] : []),
    ...(allianceBase ? [
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
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 p-2 rounded-lg"
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
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 w-full transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
