'use client'
import { useState, useEffect, useRef } from 'react'

const PALETTE = [
  'bg-amber-600',
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-orange-600',
]

function colorFor(name: string): string {
  const sum = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]
}

interface PlayerAvatarProps {
  /** The player's in-game ID (game_id). Avatar is only fetched when this is set. */
  gameId?: string | null
  /** Player display name — used for initials fallback and accessible alt text. */
  playerName: string
  /**
   * Tailwind classes that set the circle's width/height.
   * Defaults to "w-9 h-9".  Must be complete class names (no dynamic
   * interpolation) so Tailwind includes them in the build.
   */
  sizeClass?: string
  /** Show a small "Lv.N" badge after the avatar. */
  showLevel?: boolean
  /** Show a small "KN" kingdom tag after the avatar. */
  showKingdom?: boolean
}

/**
 * Lazy-loading player avatar.
 *
 * - Uses an IntersectionObserver so avatars off-screen are not fetched.
 * - Falls back to a coloured circle with initials when no gameId is set, or
 *   when the API lookup fails.
 * - Calls /api/player-lookup (server-side proxy) — never calls kingshot.net
 *   directly from the browser.
 */
export function PlayerAvatar({
  gameId,
  playerName,
  sizeClass = 'w-9 h-9',
  showLevel = false,
  showKingdom = false,
}: PlayerAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const [kingdom, setKingdom] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const circleRef = useRef<HTMLDivElement>(null)

  const initials = playerName.slice(0, 2).toUpperCase() || '??'
  const bg = colorFor(playerName)

  useEffect(() => {
    if (!gameId) return
    const el = circleRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        observer.disconnect()

        setLoading(true)
        fetch(`/api/player-lookup?playerId=${encodeURIComponent(gameId)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => {
            if (json?.data) {
              if (json.data.profilePhoto) setAvatarUrl(json.data.profilePhoto)
              if (json.data.level) setLevel(json.data.level)
              if (json.data.kingdom) setKingdom(json.data.kingdom)
            }
          })
          .catch(() => {/* keep initials */})
          .finally(() => setLoading(false))
      },
      // Start fetching a bit before the element scrolls into view
      { rootMargin: '300px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [gameId])

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* Circle */}
      <div
        ref={circleRef}
        className={`${sizeClass} rounded-full flex-shrink-0 overflow-hidden relative`}
      >
        {/* Loading spinner overlay */}
        {loading && !avatarUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-700 rounded-full z-10">
            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={playerName}
            className="w-full h-full object-cover"
          />
        ) : !loading ? (
          <div className={`w-full h-full ${bg} flex items-center justify-center`}>
            <span className="text-xs font-bold text-white leading-none">{initials}</span>
          </div>
        ) : null}
      </div>

      {/* Optional badges */}
      {showLevel && level != null && (
        <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold leading-none whitespace-nowrap">
          Lv.{level}
        </span>
      )}
      {showKingdom && kingdom != null && (
        <span className="text-xs text-slate-400 leading-none whitespace-nowrap">
          K{kingdom}
        </span>
      )}
    </div>
  )
}
