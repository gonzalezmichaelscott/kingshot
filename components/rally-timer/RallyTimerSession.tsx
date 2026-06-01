'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Play, Square, RotateCcw, Volume2, VolumeX, Plus, Share2,
  Clock, Timer, User, Crown, Loader2, Copy, Check
} from 'lucide-react'

interface PlayerInfo {
  profilePhoto: string
  name: string
  kingdom: number
  level: number
}

interface TimerPlayer {
  id: string
  name: string
  playerId?: string
  marchTime: number // seconds
  avatar?: string
  status: 'waiting' | 'launch' | 'launched'
  launchOffset: number // seconds after BASE
}

interface Props {
  session: any
  canEdit: boolean
  allianceId: string | null
  onUpdate: (updated: any) => void
}

function parseMarchTime(input: string): number | null {
  // Accepts: "45s", "1m30s", "2m", "90s", "1:30", "90"
  const s = input.trim().toLowerCase()
  const minsec = s.match(/^(\d+)m(\d+)s?$/)
  if (minsec) return parseInt(minsec[1]) * 60 + parseInt(minsec[2])
  const mins = s.match(/^(\d+)m$/)
  if (mins) return parseInt(mins[1]) * 60
  const secs = s.match(/^(\d+)s$/)
  if (secs) return parseInt(secs[1])
  const colons = s.match(/^(\d+):(\d+)$/)
  if (colons) return parseInt(colons[1]) * 60 + parseInt(colons[2])
  const raw = s.match(/^\d+$/)
  if (raw) return parseInt(s)
  return null
}

function formatMarchTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m${s}s`
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function RallyTimerSession({ session, canEdit, allianceId, onUpdate }: Props) {
  const [label, setLabel] = useState(session.label || 'Rally Timer')
  const [players, setPlayers] = useState<TimerPlayer[]>(() =>
    (session.players || []).map((p: any) => ({ ...p, status: 'waiting' as const }))
  )
  const [running, setRunning] = useState(session.status === 'running')
  const [elapsed, setElapsed] = useState(0) // seconds since start
  const [startedAt, setStartedAt] = useState<number | null>(
    session.started_at ? new Date(session.started_at).getTime() : null
  )
  const [audioOn, setAudioOn] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [marchInput, setMarchInput] = useState('')
  const [marchError, setMarchError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [saving, setSaving] = useState(false)
  // Cache of playerId -> fetched PlayerInfo so we never fetch the same ID twice
  const [playerCache, setPlayerCache] = useState<Map<string, PlayerInfo>>(new Map())
  const [fetchingPlayer, setFetchingPlayer] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const alertedRef = useRef<Set<string>>(new Set())
  const playerFetchTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Ref to read the current `name` value inside the debounced fetch without
  // including it as an effect dependency (so we don't re-trigger on name type)
  const nameRef = useRef(name)
  const supabase = createClient()

  // Keep nameRef in sync
  useEffect(() => { nameRef.current = name }, [name])

  // Build the shareable URL once we're in the browser (needs window.location.origin)
  useEffect(() => {
    if (session.id && typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/rally-timer/${session.id}`)
    }
  }, [session.id])

  // Debounced fetch when playerId input changes
  useEffect(() => {
    const trimmed = playerId.trim()
    if (!trimmed) return

    // Already cached — just auto-fill if name is blank
    if (playerCache.has(trimmed)) {
      const cached = playerCache.get(trimmed)!
      if (!nameRef.current.trim() && cached.name) setName(cached.name)
      return
    }

    if (playerFetchTimerRef.current) clearTimeout(playerFetchTimerRef.current)
    playerFetchTimerRef.current = setTimeout(async () => {
      setFetchingPlayer(true)
      try {
        const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          const json = await res.json()
          if (json.data) {
            setPlayerCache(prev => {
              const next = new Map(prev)
              next.set(trimmed, json.data as PlayerInfo)
              return next
            })
            // Auto-fill name only if the field is still empty
            if (!nameRef.current.trim() && json.data.name) {
              setName(json.data.name)
            }
          }
        }
      } catch {
        // ignore — avatar stays as initials
      } finally {
        setFetchingPlayer(false)
      }
    }, 600)

    return () => {
      if (playerFetchTimerRef.current) clearTimeout(playerFetchTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  // Realtime sync for shared sessions
  useEffect(() => {
    if (!session.id) return
    const channel = supabase
      .channel(`rally:${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rally_timer_sessions', filter: `id=eq.${session.id}` }, (payload) => {
        const s = payload.new as any
        if (s.status === 'running' && s.started_at) {
          const t = new Date(s.started_at).getTime()
          setStartedAt(t)
          setRunning(true)
        } else if (s.status === 'idle' || s.status === 'complete') {
          setRunning(false)
          setElapsed(0)
          setStartedAt(null)
          setPlayers(prev => prev.map(p => ({ ...p, status: 'waiting' })))
          alertedRef.current.clear()
        }
        if (s.players) {
          setPlayers((s.players as any[]).map((p: any) => ({ ...p, status: 'waiting' as const })))
        }
        setLabel(s.label || label)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id])

  // Timer tick
  useEffect(() => {
    if (running && startedAt) {
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const el = Math.floor((now - startedAt) / 1000)
        setElapsed(el)

        // Check which players should launch
        const base = players.reduce((max, p) => p.marchTime > max ? p.marchTime : max, 0)
        players.forEach(p => {
          const offset = base - p.marchTime
          if (el >= offset && !alertedRef.current.has(p.id) && p.marchTime !== base) {
            alertedRef.current.add(p.id)
            if (audioOn) speak(`Launch now ${p.name}`)
            setPlayers(prev => prev.map(pp => pp.id === p.id ? { ...pp, status: 'launch' } : pp))
            setTimeout(() => {
              setPlayers(prev => prev.map(pp => pp.id === p.id ? { ...pp, status: 'launched' } : pp))
            }, 5000)
          }
        })
      }, 250)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, startedAt, players, audioOn])

  function speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.1
    utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }

  const sortedPlayers = [...players].sort((a, b) => b.marchTime - a.marchTime)
  const baseTime = sortedPlayers[0]?.marchTime || 0

  function computeOffset(p: TimerPlayer) {
    return baseTime - p.marchTime
  }

  async function saveSession(updates: any) {
    const merged = { ...session, label, players, ...updates }
    if (session.id && canEdit) {
      setSaving(true)
      await fetch('/api/rally-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id, ...merged }),
      })
      setSaving(false)
    }
    onUpdate(merged)
  }

  async function startRally() {
    if (players.length === 0) return
    alertedRef.current.clear()

    if (countdown !== null) {
      // 3-2-1 countdown
      for (let i = 3; i > 0; i--) {
        setCountdown(i)
        if (audioOn) speak(String(i))
        await new Promise(r => setTimeout(r, 1000))
      }
      setCountdown(null)
    }

    const now = Date.now()
    setStartedAt(now)
    setRunning(true)
    setElapsed(0)
    setPlayers(prev => prev.map(p => ({ ...p, status: 'waiting' })))

    if (audioOn) speak('Rally started')
    await saveSession({ status: 'running', started_at: new Date(now).toISOString() })
  }

  async function stopRally() {
    setRunning(false)
    setElapsed(0)
    setStartedAt(null)
    setPlayers(prev => prev.map(p => ({ ...p, status: 'waiting' })))
    alertedRef.current.clear()
    await saveSession({ status: 'idle', started_at: null })
  }

  async function addPlayer() {
    setMarchError('')
    if (!name.trim()) return
    const secs = parseMarchTime(marchInput)
    if (secs === null) {
      setMarchError('Invalid time. Try "1m30s", "90s", "1:30"')
      return
    }
    const newPlayer: TimerPlayer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      playerId: playerId.trim() || undefined,
      marchTime: secs,
      status: 'waiting',
      launchOffset: 0,
    }

    // Use cached avatar from the debounce-prefetch, or fetch inline as fallback
    const trimmedId = playerId.trim()
    if (trimmedId) {
      const cached = playerCache.get(trimmedId)
      if (cached?.profilePhoto) {
        newPlayer.avatar = cached.profilePhoto
      } else {
        try {
          const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(trimmedId)}`)
          if (res.ok) {
            const json = await res.json()
            if (json.data) {
              setPlayerCache(prev => {
                const next = new Map(prev)
                next.set(trimmedId, json.data as PlayerInfo)
                return next
              })
              if (json.data.profilePhoto) newPlayer.avatar = json.data.profilePhoto
            }
          }
        } catch {
          // Avatar fetch failed — initials will be shown instead
        }
      }
    }

    const updated = [...players, newPlayer]
    setPlayers(updated)
    setName('')
    setPlayerId('')
    setMarchInput('')
    await saveSession({ players: updated })
  }

  async function removePlayer(id: string) {
    const updated = players.filter(p => p.id !== id)
    setPlayers(updated)
    await saveSession({ players: updated })
  }

  function copyShareLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const base = sortedPlayers[0]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
      {/* Session header */}
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-amber-500 flex-shrink-0" />
        {canEdit ? (
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => saveSession({})}
            className="flex-1 bg-transparent text-base font-bold text-slate-100 focus:outline-none border-b border-transparent focus:border-amber-500 transition-colors"
          />
        ) : (
          <span className="font-bold text-base">{label}</span>
        )}
        {session.id && (
          <button
            onClick={() => setShowShare(true)}
            className="text-slate-400 hover:text-amber-400 transition-colors p-1 rounded"
            title="Share this timer"
          >
            <Share2 size={14} />
          </button>
        )}
      </div>

      {/* Visible shareable link — available before the timer starts so leaders can
          send it to their squad in advance. */}
      {session.id && shareUrl && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Shareable link (view-only for squad)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-amber-300 bg-slate-900 rounded px-2 py-1.5 truncate">{shareUrl}</code>
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShare && session.id && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowShare(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-amber-500" />
              <h3 className="font-bold text-lg">Share “{label}”</h3>
            </div>
            <p className="text-sm text-slate-400">
              Anyone with this link can watch the timer live (read-only). Share it with your squad before you start.
            </p>
            <code className="block text-xs text-amber-300 bg-slate-800 rounded-lg px-3 py-2 break-all">{shareUrl}</code>
            <div className="flex gap-2">
              <button
                onClick={copyShareLink}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold transition-colors"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => setShowShare(false)}
                className="px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elapsed timer display */}
      <div className="text-center py-3">
        <div className={`text-5xl font-mono font-bold tracking-wider ${running ? 'text-amber-400' : 'text-slate-600'}`}>
          {countdown !== null ? countdown : formatElapsed(elapsed)}
        </div>
        {running && base && (
          <p className="text-xs text-slate-400 mt-1">BASE: {base.name} ({formatMarchTime(base.marchTime)})</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {!running ? (
          <button
            onClick={startRally}
            disabled={players.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            <Play size={15} />
            Start Rally
          </button>
        ) : (
          <button
            onClick={stopRally}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Square size={15} />
            Stop
          </button>
        )}
        <button
          onClick={stopRally}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => setAudioOn(a => !a)}
          className={`p-2 rounded-lg transition-colors ${audioOn ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-800'}`}
          title={audioOn ? 'Audio on' : 'Audio off'}
        >
          {audioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={countdown !== null}
            onChange={e => setCountdown(e.target.checked ? 3 : null)}
            className="accent-amber-500"
          />
          3-2-1 countdown
        </label>
      </div>

      {/* Add player form */}
      {canEdit && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="Player name *"
              className="px-3 h-9 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {/* Player ID with loading spinner */}
            <div className="relative">
              <input
                value={playerId}
                onChange={e => setPlayerId(e.target.value)}
                placeholder="Player ID (optional)"
                className="w-full px-3 pr-8 h-9 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {fetchingPlayer && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 size={14} className="animate-spin text-amber-400" />
                </div>
              )}
              {!fetchingPlayer && playerId.trim() && playerCache.has(playerId.trim()) && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <span className="text-green-400 text-xs">✓</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={marchInput}
              onChange={e => setMarchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder='March time: "1m30s", "90s", "2m"'
              className="flex-1 px-3 h-9 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={addPlayer}
              className="px-3 h-9 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold text-sm transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>
          {marchError && <p className="text-red-400 text-xs">{marchError}</p>}
        </div>
      )}

      {/* Player cards */}
      {sortedPlayers.length > 0 && (
        <div className="space-y-2">
          {sortedPlayers.map((p, idx) => {
            const isBase = p.marchTime === baseTime && idx === 0
            const offset = computeOffset(p)
            const isLaunching = p.status === 'launch'
            const hasLaunched = p.status === 'launched'

            const cardClass = isLaunching
              ? 'border-green-500 bg-green-500/20 animate-pulse'
              : hasLaunched
              ? 'border-slate-700 bg-slate-800/50 opacity-60'
              : isBase
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-slate-700 bg-slate-800'

            return (
              <div key={p.id} className={`border rounded-xl p-3 transition-all ${cardClass}`}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">{p.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isBase && <Crown size={12} className="text-amber-400" />}
                      <span className="font-semibold text-sm truncate">{p.name}</span>
                      {isLaunching && <span className="text-green-400 font-bold text-xs">LAUNCH NOW!</span>}
                      {hasLaunched && <span className="text-slate-500 text-xs">Launched</span>}
                    </div>
                    <div className="flex gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {formatMarchTime(p.marchTime)}
                      </span>
                      {isBase ? (
                        <span className="text-amber-400 font-semibold">BASE — opens rally first</span>
                      ) : (
                        <span>
                          Launch <span className="text-amber-300 font-medium">{formatMarchTime(offset)}</span> after BASE
                          {running && elapsed >= 0 && offset > elapsed && (
                            <span className="ml-1 text-slate-500">({formatMarchTime(offset - elapsed)} remaining)</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {canEdit && !running && (
                    <button
                      onClick={() => removePlayer(p.id)}
                      className="text-red-500/50 hover:text-red-400 p-1 flex-shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {players.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-4">
          Add players to start. The one with the longest march time is the BASE.
        </p>
      )}

      {/* Rally sequence summary */}
      {sortedPlayers.length > 1 && (
        <div className="border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">Launch sequence</p>
          <div className="space-y-0.5">
            {sortedPlayers.map((p, i) => {
              const offset = computeOffset(p)
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-4">{i + 1}.</span>
                  <span className="text-slate-300 flex-1">{p.name}</span>
                  <span className="text-amber-400 font-mono">
                    {offset === 0 ? 'IMMEDIATELY' : `+${formatMarchTime(offset)}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
