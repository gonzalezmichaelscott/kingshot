'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Timer, Clock, Crown, Volume2, VolumeX, Layers, Flag, Trash2 } from 'lucide-react'
import { computePlan, waveLabel, type LandingMode } from '@/lib/rally-timer'

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

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1.1
  window.speechSynthesis.speak(utt)
}

interface Props {
  session: any
}

export function SharedTimerView({ session }: Props) {
  const [players, setPlayers] = useState<any[]>(session.players || [])
  const [label, setLabel] = useState(session.label || 'Rally Timer')
  const [status, setStatus] = useState<'idle' | 'running'>(session.status === 'running' ? 'running' : 'idle')
  const [startedAt, setStartedAt] = useState<number | null>(
    session.started_at ? new Date(session.started_at).getTime() : null
  )
  const [landingMode, setLandingMode] = useState<LandingMode>(session.landing_mode === 'staggered' ? 'staggered' : 'simultaneous')
  const [landingGap, setLandingGap] = useState<number>(session.landing_gap || 3)
  const [customOrder, setCustomOrder] = useState<string[] | null>(session.custom_order || null)
  const [round, setRound] = useState<number>(session.round || 1)
  const [elapsed, setElapsed] = useState(0)
  const [countdownNum, setCountdownNum] = useState<number | null>(null)
  const [audioOn, setAudioOn] = useState(true)
  const [resetCancelled, setResetCancelled] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const alertedRef = useRef<Set<string>>(new Set())
  const landedRef = useRef<Set<string>>(new Set())
  const allLandedSpokenRef = useRef(false)
  const spokenCountdownRef = useRef<Set<number>>(new Set())
  const supabase = createClient()

  function clearRoundRefs() {
    alertedRef.current.clear()
    spokenCountdownRef.current.clear()
    landedRef.current.clear()
    allLandedSpokenRef.current = false
  }

  // Apply a synced snapshot (broadcast OR postgres change).
  function applySnapshot(s: any) {
    if (s.label !== undefined) setLabel(s.label || 'Rally Timer')
    if (s.players) setPlayers(s.players || [])
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
    const channel = supabase.channel(`rally-timer:${session.id}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'timer_started' }, ({ payload }) => applySnapshot({ ...payload, status: 'running' }))
      .on('broadcast', { event: 'timer_reset' }, ({ payload }) => applySnapshot({ status: 'idle', ...(payload || {}) }))
      .on('broadcast', { event: 'timer_hard_reset' }, () => applySnapshot({
        status: 'idle', players: [], custom_order: null, round: 1,
        landing_mode: 'simultaneous', landing_gap: 3,
      }))
      .on('broadcast', { event: 'reset_cancelled' }, () => setResetCancelled(true))
      .on('broadcast', { event: 'session_deleted' }, () => setDeleted(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rally_timer_sessions', filter: `id=eq.${session.id}` }, (payload) => {
        applySnapshot(payload.new as any)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rally_timer_sessions', filter: `id=eq.${session.id}` }, () => {
        setDeleted(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  // Unified tick (identical to the leader): countdown → elapsed → launch + landing audio.
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

      plan.forEach(cp => {
        if (el >= cp.launchOffset && !alertedRef.current.has(cp.id)) {
          alertedRef.current.add(cp.id)
          if (audioOn) {
            const wave = landingMode === 'staggered' ? ` — ${waveLabel(cp.orderIndex, total)}` : ''
            speak(`Launch now ${cp.name}${wave}`)
          }
        }
      })

      if (landingMode === 'staggered') {
        plan.forEach(cp => {
          if (el >= cp.arrivalOffset && !landedRef.current.has(cp.id)) {
            landedRef.current.add(cp.id)
            if (audioOn) speak(`Rally landed — ${cp.name}`)
          }
        })
      }

      if (el >= lastArrival && !allLandedSpokenRef.current) {
        allLandedSpokenRef.current = true
        if (audioOn) {
          speak(landingMode === 'simultaneous'
            ? 'All rallies landed. Preparing for next round.'
            : 'All rallies have landed. Preparing for next round.')
        }
      }
    }
    const id = setInterval(tick, 250)
    tick()
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, startedAt, players, audioOn, landingMode, landingGap, customOrder])

  const plan = computePlan(players, landingMode, landingGap, customOrder)
  const running = status === 'running'
  const lastArrival = plan.length ? Math.max(...plan.map(p => p.arrivalOffset)) : 0
  const allLanded = running && countdownNum === null && plan.length > 0 && elapsed >= lastArrival
  const sinceAllLanded = elapsed - lastArrival
  const showBanner = allLanded && sinceAllLanded < 5
  const resetCountdown = Math.max(0, 10 - sinceAllLanded)
  const showResetCountdown = allLanded && !resetCancelled && resetCountdown > 0

  if (deleted) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 flex items-center justify-center">
        <div className="max-w-sm w-full text-center space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <Trash2 className="mx-auto text-red-500" size={32} />
          <h1 className="text-lg font-bold text-slate-100">Timer session deleted</h1>
          <p className="text-sm text-slate-400">This timer session has been deleted by the leader.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-3 sm:p-4 flex items-start justify-center max-w-full overflow-x-hidden">
      <div className="w-full max-w-md space-y-4 pt-6 sm:pt-8 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Timer className="text-amber-500 flex-shrink-0" size={22} />
            <h1 className="text-lg sm:text-xl font-bold truncate">{label}</h1>
            <span className="text-[11px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">
              Round {round}
            </span>
            <span className="text-[11px] bg-slate-700 text-slate-300 border border-slate-600 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0">
              View Only
            </span>
          </div>
          <button onClick={() => setAudioOn(a => !a)} className={`flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-lg ${audioOn ? 'text-amber-400' : 'text-slate-600'}`}>
            {audioOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          Shared view — read only. Starts automatically when the leader starts.
          {landingMode === 'staggered' && <span className="text-amber-400"> · Staggered landing ({landingGap}s apart)</span>}
        </p>

        {/* Elapsed / countdown */}
        <div className="text-center py-4">
          <div className={`text-5xl sm:text-6xl font-mono font-bold ${countdownNum !== null ? 'text-amber-300 animate-pulse' : running ? 'text-amber-400' : 'text-slate-600'}`}>
            {countdownNum !== null ? countdownNum : formatElapsed(elapsed)}
          </div>
          {!running && <p className="text-slate-500 text-sm mt-2">Waiting for leader to start…</p>}
        </div>

        {/* All-rallies-landed banner + reset countdown (FIX 2) */}
        {allLanded && (
          <div className="border border-amber-500/60 bg-amber-500/15 rounded-xl p-3 text-center space-y-2">
            {showBanner && (
              <p className="text-amber-300 font-bold text-base flex items-center justify-center gap-2">
                <Flag size={16} /> All rallies have landed!
              </p>
            )}
            {showResetCountdown && (
              <span className="text-slate-200 text-sm font-medium">Resetting in {Math.ceil(resetCountdown)} seconds…</span>
            )}
            {resetCancelled && (
              <p className="text-slate-400 text-xs">Auto-reset cancelled by the leader.</p>
            )}
          </div>
        )}

        {/* Players */}
        <div className="space-y-2">
          {plan.map((p) => {
            const isBase = p.launchOffset === 0
            const launching = running && countdownNum === null && elapsed >= p.launchOffset && elapsed - p.launchOffset < 5 && elapsed < p.arrivalOffset
            const inTransit = running && countdownNum === null && elapsed - p.launchOffset >= 5 && elapsed < p.arrivalOffset
            const justLanded = running && countdownNum === null && elapsed >= p.arrivalOffset && elapsed - p.arrivalOffset < 4
            const landed = running && countdownNum === null && elapsed - p.arrivalOffset >= 4

            return (
              <div key={p.id} className={`border rounded-xl p-3 transition-all ${
                justLanded ? 'border-sky-400 bg-sky-400/20 animate-pulse'
                : launching ? 'border-green-500 bg-green-500/20 animate-pulse'
                : landed ? 'border-slate-700 bg-slate-800 opacity-60'
                : inTransit ? 'border-slate-700 bg-slate-800/60 opacity-80'
                : isBase ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-slate-700 bg-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-xs font-bold">{p.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {isBase && <Crown size={12} className="text-amber-400" />}
                      <span className="font-semibold text-sm">{p.name}</span>
                      {landingMode === 'staggered' && (
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Layers size={9} />{waveLabel(p.orderIndex, plan.length)}
                        </span>
                      )}
                      {justLanded && <span className="text-sky-300 font-bold text-xs ml-1">{p.name} has landed!</span>}
                      {launching && <span className="text-green-400 font-bold text-xs ml-1">LAUNCH!</span>}
                      {landed && <span className="text-slate-500 text-xs ml-1">Landed</span>}
                    </div>
                    <div className="text-xs text-slate-400 flex gap-2 flex-wrap">
                      <span className="flex items-center gap-0.5"><Clock size={10} />{formatMarchTime(p.marchTime)}</span>
                      <span>
                        Launch {p.launchOffset === 0 ? 'at 0:00' : `at ${formatClock(p.launchOffset)}`}
                        {' · arrives '}{formatElapsed(p.arrivalOffset)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {players.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No players added yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
