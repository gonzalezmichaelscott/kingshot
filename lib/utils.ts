import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPower(power: number): string {
  if (power >= 1_000_000_000) return `${(power / 1_000_000_000).toFixed(2)}B`
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(2)}M`
  if (power >= 1_000) return `${(power / 1_000).toFixed(1)}K`
  return power.toString()
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function roleColor(role: string): string {
  const map: Record<string, string> = {
    rally_leader: 'text-amber-400',
    joiner: 'text-blue-400',
    support: 'text-green-400',
    garrison: 'text-purple-400',
    flex: 'text-slate-400',
  }
  return map[role] || 'text-slate-400'
}

export function troopTypeColor(type: string): string {
  const map: Record<string, string> = {
    infantry: 'text-red-400',
    cavalry: 'text-blue-400',
    archer: 'text-green-400',
    all: 'text-amber-400',
    mixed: 'text-purple-400',
  }
  return map[type] || 'text-slate-400'
}
