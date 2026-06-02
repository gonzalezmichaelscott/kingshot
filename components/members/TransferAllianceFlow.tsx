// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowRightLeft, Search, AlertTriangle, ArrowLeft, Crown, Shield,
  CheckCircle2, UserCheck, X, Loader2,
} from 'lucide-react'

type Step = 'warning' | 'search' | 'select_alliance' | 'profile' | 'confirm' | 'done'

interface Props {
  /** Visual style of the trigger. */
  variant?: 'button' | 'link'
  /** Override the trigger label. */
  label?: string
}

export function TransferAllianceFlow({ variant = 'button', label }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('warning')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // kingdom search
  const [serverNumber, setServerNumber] = useState('')
  const [kingdom, setKingdom] = useState<any>(null)
  const [alliances, setAlliances] = useState<any[]>([])
  const [selectedAlliance, setSelectedAlliance] = useState<any>(null)

  // existing-profile search within the new alliance
  const [query, setQuery] = useState('')
  const [searchedProfile, setSearchedProfile] = useState(false)
  const [foundProfile, setFoundProfile] = useState<any>(null)
  const [mode, setMode] = useState<'create' | 'claim'>('create')

  function reset() {
    setStep('warning'); setError(''); setServerNumber(''); setKingdom(null)
    setAlliances([]); setSelectedAlliance(null); setQuery(''); setSearchedProfile(false)
    setFoundProfile(null); setMode('create'); setLoading(false)
  }

  function close() { setOpen(false); reset() }

  async function searchKingdom() {
    setLoading(true); setError('')
    const num = parseInt(serverNumber)
    if (Number.isNaN(num)) { setError('Enter a valid kingdom number'); setLoading(false); return }
    const { data: k } = await supabase.from('kingdoms').select('*').eq('server_number', num).maybeSingle()
    if (!k) { setError('No kingdom found with that server number.'); setLoading(false); return }
    const { data: al } = await supabase.from('alliances').select('id, name, tag').eq('kingdom_id', k.id).order('name')
    setKingdom(k); setAlliances(al || []); setLoading(false); setStep('select_alliance')
  }

  function pickAlliance(a: any) {
    setSelectedAlliance(a)
    setQuery(''); setSearchedProfile(false); setFoundProfile(null); setMode('create')
    setStep('profile')
  }

  async function searchProfile() {
    if (!query.trim()) return
    setLoading(true); setError(''); setFoundProfile(null); setSearchedProfile(false)
    const res = await fetch('/api/profile-claim/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alliance_id: selectedAlliance.id, query: query.trim() }),
    })
    setLoading(false); setSearchedProfile(true)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Search failed'); return }
    const { member } = await res.json()
    setFoundProfile(member || null)
    if (member && !member.already_linked) setMode('claim')
  }

  async function confirmTransfer() {
    setLoading(true); setError('')
    const res = await fetch('/api/member/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_alliance_id: selectedAlliance.id,
        target_member_id: mode === 'claim' && foundProfile ? foundProfile.id : null,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(d.error || 'Transfer failed'); return }
    setStep('done')
    // Land the player on their new self-service profile.
    setTimeout(() => {
      if (d.access_token) window.location.href = `/member/${d.access_token}`
      else window.location.href = '/dashboard'
    }, 1800)
  }

  const trigger = variant === 'link' ? (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-400 font-medium"
    >
      <ArrowRightLeft size={15} /> {label || 'Move to Different Alliance'}
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium"
    >
      <ArrowRightLeft size={15} /> {label || 'Change Kingdom & Alliance'}
    </button>
  )

  if (!open) return trigger

  return (
    <>
      {trigger}
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 h-12 border-b border-slate-800 sticky top-0 bg-slate-900">
            <h2 className="font-semibold flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-amber-500" /> Change Kingdom &amp; Alliance
            </h2>
            <button onClick={close} className="text-slate-400 hover:text-slate-100 p-1"><X size={18} /></button>
          </div>

          <div className="p-5 space-y-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* WARNING */}
            {step === 'warning' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-amber-100">
                    Changing your kingdom and alliance will move your profile to a new alliance.
                    Your stats and hero data will carry over.
                  </p>
                </div>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li><span className="text-slate-300">Carries over:</span> power, march, rally capacity, troop data, heroes, combat stats, language, willing-to-move, Player ID & governor name.</li>
                  <li><span className="text-slate-300">Stays behind:</span> event history, chat messages and old assignment history.</li>
                </ul>
                <Button className="w-full" onClick={() => setStep('search')}>Continue</Button>
              </div>
            )}

            {/* SEARCH KINGDOM */}
            {step === 'search' && (
              <div className="space-y-3">
                <label className="text-sm text-slate-400 block">Enter the new Kingdom (Server) number</label>
                <div className="flex gap-2">
                  <Input
                    type="text" inputMode="numeric" placeholder="e.g. 1511"
                    value={serverNumber}
                    onChange={e => setServerNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && searchKingdom()}
                  />
                  <Button onClick={searchKingdom} disabled={loading || !serverNumber}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  </Button>
                </div>
                <button onClick={() => setStep('warning')} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><ArrowLeft size={12} />Back</button>
              </div>
            )}

            {/* SELECT ALLIANCE */}
            {step === 'select_alliance' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 flex items-center gap-2">
                  <Crown size={16} className="text-amber-500" />{kingdom?.name}{kingdom?.server_number ? ` #${kingdom.server_number}` : ''}
                </p>
                <p className="text-sm text-slate-400">Select your new alliance:</p>
                <div className="grid gap-2">
                  {alliances.map(a => (
                    <button key={a.id} onClick={() => pickAlliance(a)}
                      className="text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-lg p-3 transition-colors">
                      <span className="font-semibold text-amber-400">[{a.tag}]</span> <span className="text-sm text-slate-300">{a.name}</span>
                    </button>
                  ))}
                  {alliances.length === 0 && <p className="text-slate-400 text-sm">No alliances registered under this kingdom yet.</p>}
                </div>
                <button onClick={() => setStep('search')} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><ArrowLeft size={12} />Back to search</button>
              </div>
            )}

            {/* FIND EXISTING PROFILE OR CREATE NEW */}
            {step === 'profile' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 flex items-center gap-2">
                  <Shield size={16} className="text-amber-500" />[{selectedAlliance?.tag}] {selectedAlliance?.name}
                </p>
                <p className="text-xs text-slate-400">
                  If an R4/R5 already created a profile for you in this alliance, find it to merge your stats into it.
                  Otherwise a new profile will be created with your stats copied over.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Player ID or Governor Name"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchProfile()}
                  />
                  <Button size="sm" onClick={searchProfile} disabled={loading || !query.trim()}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  </Button>
                </div>

                {searchedProfile && !foundProfile && (
                  <p className="text-slate-400 text-xs">No existing profile found — a new one will be created.</p>
                )}

                {foundProfile && (
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                    <p className="font-semibold text-sm">{foundProfile.player_name}</p>
                    {foundProfile.game_id && <p className="text-xs text-slate-400">ID: {foundProfile.game_id}</p>}
                    {foundProfile.already_linked ? (
                      <p className="text-xs text-amber-300">This profile is already linked to another account — you cannot merge into it.</p>
                    ) : (
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input type="checkbox" className="accent-amber-500" checked={mode === 'claim'} onChange={e => setMode(e.target.checked ? 'claim' : 'create')} />
                        Merge my stats into this existing profile
                      </label>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setStep('confirm')}>Continue</Button>
                  <Button variant="ghost" onClick={() => setStep('select_alliance')}>Back</Button>
                </div>
              </div>
            )}

            {/* CONFIRM */}
            {step === 'confirm' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">You are about to move to:</p>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <p className="text-sm"><span className="text-amber-400 font-semibold">[{selectedAlliance?.tag}] {selectedAlliance?.name}</span></p>
                  <p className="text-xs text-slate-400 mt-1">{kingdom?.name}{kingdom?.server_number ? ` #${kingdom.server_number}` : ''}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {mode === 'claim' && foundProfile
                      ? <>Merging into existing profile <span className="text-slate-200">{foundProfile.player_name}</span>.</>
                      : 'A new profile will be created with your stats copied over.'}
                  </p>
                </div>
                <p className="text-xs text-amber-400">Your stats and hero data will carry over. Event history and chat stay with your old alliance.</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={confirmTransfer} disabled={loading}>
                    {loading ? <><Loader2 size={16} className="animate-spin mr-1" />Transferring…</> : <><UserCheck size={16} className="mr-1" />Confirm Transfer</>}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep('profile')} disabled={loading}>Back</Button>
                </div>
              </div>
            )}

            {/* DONE */}
            {step === 'done' && (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="mx-auto text-green-400" size={40} />
                <p className="font-medium">Transfer complete!</p>
                <p className="text-sm text-slate-400">Your stats and hero data have moved to your new alliance. Redirecting to your updated profile…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
