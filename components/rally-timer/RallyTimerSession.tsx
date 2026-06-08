'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Play, Square, RotateCcw, Volume2, VolumeX, Plus, Share2,
  Clock, Timer, Crown, Loader2, Copy, Check, Layers, Target,
  GripVertical, Trash2, AlertTriangle, Flag
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { computePlan, waveLabel, LANDING_GAPS, type LandingMode } from '@/lib/rally-timer'
import { useNoSleep } from '@/hooks/useNoSleep'

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

// "Launch at 0:00" / "Launch at 1:27" style (no zero-padded minutes).
function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1.1
  utt.pitch = 1
  window.speechSynthesis.speak(utt)
}

// A single draggable row in the manual Landing Order list (FIX 1).
function LandingOrderItem({ id, wave, total, name, launchOffset }: {
  id: string; wave: number; total: number; name: string; launchOffset: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  const isFinisher = wave === total
  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${isFinisher ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 bg-slate-800'} touch-none`}>
      <button {...attributes} {...listeners}
        className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1 -ml-1 flex-shrink-0"
        title="Drag to reorder">
        <GripVertical size={16} />
      </button>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${isFinisher ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-200'}`}>
        {isFinisher ? 'Finisher' : `Wave ${wave}`}
      </span>
      <span className="font-semibold text-sm truncate flex-1 min-w-0">{name}</span>
      <span className="text-xs text-amber-300 font-medium whitespace-nowrap flex-shrink-0">
        Launch at {formatClock(launchOffset)}
      </span>
    </div>
  )
}

export function RallyTimerSession({ session, canEdit, allianceId, onUpdate }: Props) {
  const [label, setLabel] = useState(session.label || 'Rally Timer')
  const [players, setPlayers] = useState<TimerPlayer[]>(() =>
    (session.players || []).map((p: any) => ({ ...p }))
  )
  const [status, setStatus] = useState<'idle' | 'running'>(session.status === 'running' ? 'running' : 'idle')
  const [startedAt, setStartedAt] = useState<number | null>(
    session.started_at ? new Date(session.started_at).getTime() : null
  )
  const [elapsed, setElapsed] = useState(0)          // seconds since start (>=0)
  const [countdownNum, setCountdownNum] = useState<number | null>(null) // 3/2/1 before start
  const [audioOn, setAudioOn] = useState(true)
  // 3-2-1 countdown is ON by default (FEATURE 5)
  const [useCountdown, setUseCountdown] = useState(true)
  // Landing mode (FEATURE 7)
  const [landingMode, setLandingMode] = useState<LandingMode>(session.landing_mode === 'staggered' ? 'staggered' : 'simultaneous')
  const [landingGap, setLandingGap] = useState<number>(session.landing_gap || 3)
  // Manual landing order (FIX 1) + round counter + auto-reset (FIX 2)
  const [customOrder, setCustomOrder] = useState<string[] | null>(session.custom_order || null)
  const [round, setRound] = useState<number>(session.round || 1)
  const [resetCancelled, setResetCancelled] = useState(false)
  const [showHardReset, setShowHardReset] = useState(false)

  const [name, setName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [marchInput, setMarchInput] = useState('')
  const [marchError, setMarchError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [playerCache, setPlayerCache] = useState<Map<string, PlayerInfo>>(new Map())
  const [fetchingPlayer, setFetchingPlayer] = useState(false)

  const alertedRef = useRef<Set<string>>(new Set())       // launch announcements
  const landedRef = useRef<Set<string>>(new Set())        // per-player landing announcements
  const allLandedSpokenRef = useRef(false)                // final "all landed" announcement
  const autoResetFiredRef = useRef(false)                 // guard so auto-reset fires once
  const spokenCountdownRef = useRef<Set<number>>(new Set())
  const playerFetchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const broadcastRef = useRef<any>(null)
  const nameRef = useRef(name)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => { nameRef.current = name }, [name])

  useEffect(() => {
    if (session.id && typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/rally-timer/${session.id}`)
    }
  }, [session.id])

  // Debounced player lookup when playerId changes
  useEffect(() => {
    const trimmed = playerId.trim()
    if (!trimmed) return
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
            setPlayerCache(prev => new Map(prev).set(trimmed, json.data as PlayerInfo))
            if (!nameRef.current.trim() && json.data.name) setName(json.data.name)
          }
        }
      } catch {
        /* ignore */
      } finally {
        setFetchingPlayer(false)
      }
    }, 600)
    return () => { if (playerFetchTimerRef.current) clearTimeout(playerFetchTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  function clearRoundRefs() {
    alertedRef.current.clear()
    spokenCountdownRef.current.clear()
    landedRef.current.clear()
    allLandedSpokenRef.current = false
    autoResetFiredRef.current = false
  }

  // Apply a synced session snapshot (from broadcast OR postgres change).
  function applySnapshot(s: any) {
    if (s.label !== undefined) setLabel(s.label || 'Rally Timer')
    if (s.players) setPlayers((s.players as any[]).map((p: any) => ({ ...p })))
    if (s.landing_mode) setLandingMode(s.landing_mode === 'staggered' ? 'staggered' : 'simultaneous')
    if (s.landing_gap) setLandingGap(s.landing_gap)
    if (s.custom_order !== undefined) setCustomOrder(s.custom_order || null)
    if (s.round !== undefined && s.round !== null) setRound(s.round)
    if (s.status === 'running' && s.started_at) {
      clearRoundRefs()
      setResetCancelled(false)
      setStartedAt(new Date(s.started_at).getTime())
      setStatus('running')
    } else if (s.status === 'idle' || s.status === 'complete') {
      setStatus('idle')
      setStartedAt(null)
      setElapsed(0)
      setCountdownNum(null)
      setResetCancelled(false)
      clearRoundRefs()
    }
  }

  // Realtime: shared broadcast channel (FEATURE 4) + postgres changes fallback.
  useEffect(() => {
    if (!session.id) return
    const channel = supabase.channel(`rally-timer:${session.id}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'timer_started' }, ({ payload }) => applySnapshot({ ...payload, status: 'running' }))
      .on('broadcast', { event: 'timer_reset' }, ({ payload }) => applySnapshot({ status: 'idle', ...(payload || {}) }))
      .on('broadcast', { event: 'timer_hard_reset' }, () => applySnapshot({
        status: 'idle', players: [], custom_order: null, round: 1,
        landing_mode: 'simultaneous', landing_gap: 3, label,
      }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rally_timer_sessions', filter: `id=eq.${session.id}` }, (payload) => {
        applySnapshot(payload.new as any)
      })
      .subscribe()
    broadcastRef.current = channel
    return () => { supabase.removeChannel(channel); broadcastRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  // Unified timer tick: countdown → launches → landings → auto-reset.
  useEffect(() => {
    if (status !== 'running' || startedAt == null) return
    const tick = () => {
      const delta = Date.now() - startedAt
      if (delta < 0) {
        const c = Math.min(3, Math.max(1, Math.ceil(-delta / 1000)))
        setCountdownNum(c)
        setElapsed(0)
        if (audioOn && !spokenCountdownRef.current.has(c)) {
          spokenCountdownRef.current.add(c)
          speak(String(c))
        }
        return
      }
      setCountdownNum(null)
      const el = Math.floor(delta / 1000)
      setElapsed(el)
      const plan = computePlan(players, landingMode, landingGap, customOrder)
      const total = plan.length
      if (total === 0) return
      const lastArrival = Math.max(...plan.map(p => p.arrivalOffset))

      // Launch announcements.
      plan.forEach(cp => {
        if (el >= cp.launchOffset && !alertedRef.current.has(cp.id)) {
          alertedRef.current.add(cp.id)
          if (audioOn) {
            const wave = landingMode === 'staggered' ? ` — ${waveLabel(cp.orderIndex, total)}` : ''
            speak(`Launch now ${cp.name}${wave}`)
          }
        }
      })

      // Landing announcements (FIX 2). Staggered = per-player; simultaneous = together.
      if (landingMode === 'staggered') {
        plan.forEach(cp => {
          if (el >= cp.arrivalOffset && !landedRef.current.has(cp.id)) {
            landedRef.current.add(cp.id)
            if (audioOn) speak(`Rally landed — ${cp.name}`)
            broadcast('rally_landed', { name: cp.name })
          }
        })
      }

      // Final "all rallies landed" announcement + auto-reset trigger.
      if (el >= lastArrival && !allLandedSpokenRef.current) {
        allLandedSpokenRef.current = true
        if (audioOn) {
          speak(landingMode === 'simultaneous'
            ? 'All rallies landed. Preparing for next round.'
            : 'All rallies have landed. Preparing for next round.')
        }
        broadcast('all_rallies_landed', {})
      }

      // Auto-reset 10s after the last landing (unless cancelled). Leader only.
      if (el - lastArrival >= 10 && !resetCancelled && !autoResetFiredRef.current) {
        autoResetFiredRef.current = true
        resetRally(round + 1)
      }
    }
    const id = setInterval(tick, 250)
    tick()
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, startedAt, players, audioOn, landingMode, landingGap, customOrder, round, resetCancelled])

  const plan = computePlan(players, landingMode, landingGap, customOrder) // ordered, with offsets
  const base = plan.find(p => p.launchOffset === 0) || plan[0]
  const lastArrival = plan.length ? Math.max(...plan.map(p => p.arrivalOffset)) : 0
  const allLanded = status === 'running' && countdownNum === null && plan.length > 0 && elapsed >= lastArrival
  const sinceAllLanded = elapsed - lastArrival
  const showBanner = allLanded && sinceAllLanded < 5
  const resetCountdown = Math.max(0, 10 - sinceAllLanded)
  const showResetCountdown = allLanded && !resetCancelled && resetCountdown > 0

  async function saveSession(updates: any) {
    const merged = {
      ...session, label, players,
      landing_mode: landingMode, landing_gap: landingGap,
      custom_order: customOrder, round,
      ...updates,
    }
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

  function broadcast(event: string, payload: any) {
    broadcastRef.current?.send({ type: 'broadcast', event, payload })
  }

  async function startRally() {
    if (players.length === 0) return
    clearRoundRefs()
    setResetCancelled(false)

    // With the 3-2-1 countdown ON, the timer's true zero is 3s in the future.
    // Every device (leader + viewers) shows the same countdown then starts at the
    // same instant because they all share this started_at.
    const start = Date.now() + (useCountdown ? 3000 : 0)
    setStartedAt(start)
    setStatus('running')
    setElapsed(0)
    setCountdownNum(useCountdown ? 3 : null)

    const startedIso = new Date(start).toISOString()
    broadcast('timer_started', {
      started_at: startedIso, players, label,
      landing_mode: landingMode, landing_gap: landingGap,
      custom_order: customOrder, round,
    })
    await saveSession({ status: 'running', started_at: startedIso })
  }

  // Reset to the pre-launch ready state. Players, march times and staggered order
  // are preserved. An auto-reset after all landings bumps the round counter.
  async function resetRally(nextRound?: number) {
    const r = nextRound ?? round
    setStatus('idle')
    setStartedAt(null)
    setElapsed(0)
    setCountdownNum(null)
    setResetCancelled(false)
    clearRoundRefs()
    if (r !== round) setRound(r)
    broadcast('timer_reset', { round: r })
    await saveSession({ status: 'idle', started_at: null, round: r })
  }

  function cancelAutoReset() {
    setResetCancelled(true)
    // Tell viewers to stop their countdown display. The leader simply stops
    // counting toward a reset; nothing is persisted.
    broadcast('reset_cancelled', {})
  }

  // FIX 3 — wipe all players, settings and the round counter; session stays.
  async function hardReset() {
    setPlayers([])
    setCustomOrder(null)
    setRound(1)
    setLandingMode('simultaneous')
    setLandingGap(3)
    setStatus('idle')
    setStartedAt(null)
    setElapsed(0)
    setCountdownNum(null)
    setResetCancelled(false)
    clearRoundRefs()
    setShowHardReset(false)
    broadcast('timer_hard_reset', {})
    await saveSession({
      players: [], custom_order: null, round: 1,
      landing_mode: 'simultaneous', landing_gap: 3,
      status: 'idle', started_at: null,
    })
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
      launchOffset: 0,
    }
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
              setPlayerCache(prev => new Map(prev).set(trimmedId, json.data as PlayerInfo))
              if (json.data.profilePhoto) newPlayer.avatar = json.data.profilePhoto
            }
          }
        } catch { /* initials fallback */ }
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
    const newOrder = customOrder ? customOrder.filter(pid => pid !== id) : null
    setPlayers(updated)
    setCustomOrder(newOrder)
    await saveSession({ players: updated, custom_order: newOrder })
  }

  // FIX 1 — drag to reorder the landing waves; persist so all viewers match.
  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = plan.map(p => p.id)
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(ids, oldIndex, newIndex)
    setCustomOrder(next)
    await saveSession({ custom_order: next })
  }

  async function resetToAuto() {
    setCustomOrder(null)
    await saveSession({ custom_order: null })
  }

  function copyShareLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const running = status === 'running'

  // Keep the screen awake while a rally timer is actively running (silent, no badge)
  useNoSleep(running)

  const orderIds = plan.map(p => p.id)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-4 max-w-full min-w-0 overflow-hidden">
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
          <span className="font-bold text-base flex-1">{label}</span>
        )}
        <span className="text-[11px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">
          Round {round}
        </span>
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

      {/* Visible shareable link */}
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowShare(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-amber-500" />
              <h3 className="font-bold text-lg">Share “{label}”</h3>
            </div>
            <p className="text-sm text-slate-400">
              Anyone with this link watches the timer live (read-only). When you press Start, every device starts together.
            </p>
            <code className="block text-xs text-amber-300 bg-slate-800 rounded-lg px-3 py-2 break-all">{shareUrl}</code>
            <div className="flex gap-2">
              <button onClick={copyShareLink} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold transition-colors">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button onClick={() => setShowShare(false)} className="px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Timer display */}
      <div className="text-center py-3">
        <div className={`text-4xl sm:text-5xl font-mono font-bold tracking-wider ${countdownNum !== null ? 'text-amber-300 animate-pulse' : running ? 'text-amber-400' : 'text-slate-600'}`}>
          {countdownNum !== null ? countdownNum : formatElapsed(elapsed)}
        </div>
        {running && base && countdownNum === null && (
          <p className="text-xs text-slate-400 mt-1">
            BASE: {base.name} ({formatMarchTime(base.marchTime)})
            {landingMode === 'staggered' && <span className="text-amber-400"> · launches first</span>}
          </p>
        )}
      </div>

      {/* All-rallies-landed banner + auto-reset countdown (FIX 2) */}
      {allLanded && (
        <div className="border border-amber-500/60 bg-amber-500/15 rounded-xl p-3 text-center space-y-2">
          {showBanner && (
            <p className="text-amber-300 font-bold text-base flex items-center justify-center gap-2">
              <Flag size={16} /> All rallies have landed!
            </p>
          )}
          {showResetCountdown && (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-slate-200 text-sm font-medium">Resetting in {Math.ceil(resetCountdown)} seconds…</span>
              <button onClick={cancelAutoReset}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors">
                Cancel Reset
              </button>
            </div>
          )}
          {resetCancelled && (
            <p className="text-slate-400 text-xs">Auto-reset cancelled. Press Stop to reset manually.</p>
          )}
        </div>
      )}

      {/* Controls — min 44px touch targets for easy tapping on mobile */}
      <div className="flex items-center gap-2 flex-wrap">
        {!running ? (
          <button onClick={startRally} disabled={players.length === 0}
            className="flex items-center justify-center gap-2 px-4 min-h-[44px] bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors">
            <Play size={15} /> Start Rally
          </button>
        ) : (
          <button onClick={() => resetRally()}
            className="flex items-center justify-center gap-2 px-4 min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">
            <Square size={15} /> Stop
          </button>
        )}
        <button onClick={() => resetRally()} className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors" title="Reset">
          <RotateCcw size={16} />
        </button>
        <button onClick={() => setAudioOn(a => !a)}
          className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${audioOn ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-800'}`}
          title={audioOn ? 'Audio on' : 'Audio off'}>
          {audioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer min-h-[44px]">
          <input type="checkbox" checked={useCountdown} onChange={e => setUseCountdown(e.target.checked)} className="accent-amber-500" />
          3-2-1 countdown
        </label>
      </div>

      {/* Landing mode (FEATURE 7) */}
      {canEdit && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => { setLandingMode('simultaneous'); saveSession({ landing_mode: 'simultaneous' }) }}
              disabled={running}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${landingMode === 'simultaneous' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              <Target size={13} className="flex-shrink-0" /> Simultaneous Landing
            </button>
            <button
              onClick={() => { setLandingMode('staggered'); saveSession({ landing_mode: 'staggered' }) }}
              disabled={running}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${landingMode === 'staggered' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              <Layers size={13} className="flex-shrink-0" /> Staggered Landing
            </button>
          </div>
          {landingMode === 'staggered' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Gap between landings:</span>
              <select
                value={landingGap}
                disabled={running}
                onChange={e => { const g = parseInt(e.target.value); setLandingGap(g); saveSession({ landing_gap: g }) }}
                className="h-8 px-2 bg-slate-800 border border-slate-700 rounded text-slate-200 disabled:opacity-50"
              >
                {LANDING_GAPS.map(g => <option key={g} value={g}>{g} second{g > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Manual Landing Order (FIX 1) — staggered mode only, leaders only, when idle */}
      {canEdit && landingMode === 'staggered' && !running && plan.length > 0 && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Landing Order</p>
            <button onClick={resetToAuto}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors">
              <RotateCcw size={12} /> Reset to Auto
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Wave 1 lands FIRST (weakens defenses) · last wave is the Finisher (captures). Drag to reorder.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {plan.map(p => (
                  <LandingOrderItem key={p.id} id={p.id} wave={p.wave} total={plan.length} name={p.name} launchOffset={p.launchOffset} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add player form */}
      {canEdit && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="Player name *" className="min-w-0 w-full px-3 h-11 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
            <div className="relative min-w-0">
              <input value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="Player ID (optional)"
                className="w-full px-3 pr-8 h-11 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
              {fetchingPlayer && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 size={14} className="animate-spin text-amber-400" />
                </div>
              )}
              {!fetchingPlayer && playerId.trim() && playerCache.has(playerId.trim()) && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"><span className="text-green-400 text-xs">✓</span></div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input value={marchInput} onChange={e => setMarchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder='March time: "1m30s", "90s", "2m"' className="flex-1 min-w-0 px-3 h-11 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
            <button onClick={addPlayer} className="flex items-center justify-center w-11 h-11 flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-semibold text-sm transition-colors">
              <Plus size={15} />
            </button>
          </div>
          {marchError && <p className="text-red-400 text-xs">{marchError}</p>}
        </div>
      )}

      {/* Player cards */}
      {plan.length > 0 && (
        <div className="space-y-2">
          {plan.map((p) => {
            const isBase = p.launchOffset === 0
            const launching = running && countdownNum === null && elapsed >= p.launchOffset && elapsed - p.launchOffset < 5 && elapsed < p.arrivalOffset
            const inTransit = running && countdownNum === null && elapsed - p.launchOffset >= 5 && elapsed < p.arrivalOffset
            const justLanded = running && countdownNum === null && elapsed >= p.arrivalOffset && elapsed - p.arrivalOffset < 4
            const landed = running && countdownNum === null && elapsed - p.arrivalOffset >= 4
            const remaining = p.launchOffset - elapsed

            const cardClass = justLanded
              ? 'border-sky-400 bg-sky-400/20 animate-pulse'
              : launching
              ? 'border-green-500 bg-green-500/20 animate-pulse'
              : landed
              ? 'border-slate-700 bg-slate-800/50 opacity-60'
              : inTransit
              ? 'border-slate-700 bg-slate-800/50 opacity-80'
              : isBase
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-slate-700 bg-slate-800'

            return (
              <div key={p.id} className={`border rounded-xl p-3 transition-all ${cardClass}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">{p.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isBase && <Crown size={12} className="text-amber-400" />}
                      <span className="font-semibold text-sm truncate">{p.name}</span>
                      {landingMode === 'staggered' && (
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{waveLabel(p.orderIndex, plan.length)}</span>
                      )}
                      {justLanded && <span className="text-sky-300 font-bold text-xs">{p.name} has landed!</span>}
                      {launching && <span className="text-green-400 font-bold text-xs">LAUNCH NOW!</span>}
                      {landed && <span className="text-slate-500 text-xs">Landed</span>}
                    </div>
                    <div className="flex gap-2 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-0.5"><Clock size={10} />{formatMarchTime(p.marchTime)}</span>
                      <span>
                        Launch <span className="text-amber-300 font-medium">{p.launchOffset === 0 ? 'at 0:00' : `at ${formatClock(p.launchOffset)}`}</span>
                        {' · arrives '}<span className="text-slate-300">{formatElapsed(p.arrivalOffset)}</span>
                        {running && countdownNum === null && remaining > 0 && (
                          <span className="ml-1 text-slate-500">({formatMarchTime(remaining)} remaining)</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {canEdit && !running && (
                    <button onClick={() => removePlayer(p.id)} className="text-red-500/50 hover:text-red-400 p-1 flex-shrink-0">×</button>
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

      {/* Launch sequence summary */}
      {plan.length > 1 && (
        <div className="border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">
            Launch sequence {landingMode === 'staggered' ? `· staggered (${landingGap}s apart)` : '· simultaneous landing'}
          </p>
          <div className="space-y-0.5">
            {[...plan].sort((a, b) => a.launchOffset - b.launchOffset).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 w-4">{i + 1}.</span>
                <span className="text-slate-300 flex-1">{p.name}</span>
                <span className="text-slate-500">arrives {formatElapsed(p.arrivalOffset)}</span>
                <span className="text-amber-400 font-mono w-20 text-right">
                  {p.launchOffset === 0 ? 'IMMEDIATELY' : `+${formatMarchTime(p.launchOffset)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hard reset (FIX 3) — R4/R5/system_admin only (canEdit) */}
      {canEdit && session.id && (
        <div className="border-t border-slate-800 pt-3">
          <button onClick={() => setShowHardReset(true)}
            className="flex items-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-900/70 border border-red-800/60 text-red-300 rounded-lg text-xs font-semibold transition-colors">
            <Trash2 size={14} /> Hard Reset
          </button>
        </div>
      )}

      {/* Hard reset confirmation */}
      {showHardReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowHardReset(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <h3 className="font-bold text-lg">Hard Reset</h3>
            </div>
            <p className="text-sm text-slate-400">
              This will clear all players and settings from this timer. Are you sure?
            </p>
            <div className="flex gap-2">
              <button onClick={hardReset}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">
                Hard Reset
              </button>
              <button onClick={() => setShowHardReset(false)}
                className="px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
