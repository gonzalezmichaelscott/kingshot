'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Timer, Clock, Crown, Volume2, VolumeX } from 'lucide-react'

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

interface Props {
  session: any
}

export function SharedTimerView({ session }: Props) {
  const [players, setPlayers] = useState<any[]>(session.players || [])
  const [label, setLabel] = useState(session.label || 'Rally Timer')
  const [running, setRunning] = useState(session.status === 'running')
  const [startedAt, setStartedAt] = useState<number | null>(
    session.started_at ? new Date(session.started_at).getTime() : null
  )
  const [elapsed, setElapsed] = useState(0)
  const [audioOn, setAudioOn] = useState(true)
  const alertedRef = useRef<Set<string>>(new Set())
  const supabase = createClient()

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`shared:${session.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rally_timer_sessions', filter: `id=eq.${session.id}` }, (payload) => {
        const s = payload.new as any
        setLabel(s.label || label)
        setPlayers(s.players || [])
        if (s.status === 'running' && s.started_at) {
          setStartedAt(new Date(s.started_at).getTime())
          setRunning(true)
          alertedRef.current.clear()
        } else if (s.status === 'idle' || s.status === 'complete') {
          setRunning(false)
          setElapsed(0)
          setStartedAt(null)
          alertedRef.current.clear()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.id])

  // Timer tick
  useEffect(() => {
    let id: NodeJS.Timeout
    if (running && startedAt) {
      id = setInterval(() => {
        const el = Math.floor((Date.now() - startedAt) / 1000)
        setElapsed(el)
        const sorted = [...players].sort((a, b) => b.marchTime - a.marchTime)
        const base = sorted[0]?.marchTime || 0
        players.forEach(p => {
          const offset = base - p.marchTime
          if (el >= offset && !alertedRef.current.has(p.id) && p.marchTime !== base) {
            alertedRef.current.add(p.id)
            if (audioOn && window.speechSynthesis) {
              const utt = new SpeechSynthesisUtterance(`Launch now ${p.name}`)
              utt.rate = 1.1
              window.speechSynthesis.speak(utt)
            }
          }
        })
      }, 250)
    }
    return () => clearInterval(id)
  }, [running, startedAt, players, audioOn])

  const sortedPlayers = [...players].sort((a: any, b: any) => b.marchTime - a.marchTime)
  const baseTime = sortedPlayers[0]?.marchTime || 0

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex items-start justify-center">
      <div className="w-full max-w-md space-y-4 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="text-amber-500" size={22} />
            <h1 className="text-xl font-bold">{label}</h1>
          </div>
          <button onClick={() => setAudioOn(a => !a)} className={`p-2 rounded-lg ${audioOn ? 'text-amber-400' : 'text-slate-600'}`}>
            {audioOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center">Shared view — read only. Timer is synced live.</p>

        {/* Elapsed */}
        <div className="text-center py-4">
          <div className={`text-6xl font-mono font-bold ${running ? 'text-amber-400' : 'text-slate-600'}`}>
            {formatElapsed(elapsed)}
          </div>
          {!running && <p className="text-slate-500 text-sm mt-2">Waiting for leader to start…</p>}
        </div>

        {/* Players */}
        <div className="space-y-2">
          {sortedPlayers.map((p: any, i: number) => {
            const isBase = i === 0
            const offset = baseTime - p.marchTime
            const launched = running && elapsed >= offset && !isBase

            return (
              <div key={p.id} className={`border rounded-xl p-3 transition-all ${
                launched && elapsed - offset < 5 ? 'border-green-500 bg-green-500/20 animate-pulse'
                : launched ? 'border-slate-700 bg-slate-800 opacity-60'
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
                    <div className="flex items-center gap-1">
                      {isBase && <Crown size={12} className="text-amber-400" />}
                      <span className="font-semibold text-sm">{p.name}</span>
                      {launched && elapsed - offset < 5 && <span className="text-green-400 font-bold text-xs ml-1">LAUNCH!</span>}
                      {launched && elapsed - offset >= 5 && <span className="text-slate-500 text-xs ml-1">Launched</span>}
                    </div>
                    <div className="text-xs text-slate-400 flex gap-2">
                      <span className="flex items-center gap-0.5"><Clock size={10} />{formatMarchTime(p.marchTime)}</span>
                      {isBase ? (
                        <span className="text-amber-400">BASE — opens first</span>
                      ) : (
                        <span>+{formatMarchTime(offset)} after BASE</span>
                      )}
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
