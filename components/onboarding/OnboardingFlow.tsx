// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Shield, Crown, ArrowLeft, CheckCircle, Users } from 'lucide-react'
import { ProfileClaimStep } from '@/components/members/ProfileClaimStep'

type Step = 'search' | 'select_alliance' | 'claim_or_create' | 'create_profile' | 'new_kingdom' | 'new_alliance' | 'submitted'

const RANKS = ['r1', 'r2', 'r3', 'r4', 'r5']
const LEADER_RANKS = ['r4', 'r5']

export function OnboardingFlow() {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('search')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittedMsg, setSubmittedMsg] = useState('')

  // search
  const [serverNumber, setServerNumber] = useState('')
  const [kingdom, setKingdom] = useState<any>(null)
  const [alliances, setAlliances] = useState<any[]>([])

  // selection
  const [selectedAlliance, setSelectedAlliance] = useState<any>(null)

  // profile fields
  const [governorName, setGovernorName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [rank, setRank] = useState('r3')

  // new kingdom / alliance fields
  const [newKingdomName, setNewKingdomName] = useState('')
  const [allianceName, setAllianceName] = useState('')
  const [allianceTag, setAllianceTag] = useState('')

  async function searchKingdom() {
    setLoading(true); setError('')
    const num = parseInt(serverNumber)
    if (Number.isNaN(num)) { setError('Enter a valid kingdom number'); setLoading(false); return }
    const { data: k } = await supabase.from('kingdoms').select('*').eq('server_number', num).maybeSingle()
    if (!k) {
      setLoading(false)
      setRank('r4')
      setStep('new_kingdom')
      return
    }
    const { data: al } = await supabase.from('alliances').select('id, name, tag').eq('kingdom_id', k.id).order('name')
    setKingdom(k)
    setAlliances(al || [])
    setLoading(false)
    setStep('select_alliance')
  }

  async function submitProfileRequest() {
    setLoading(true); setError('')
    const res = await fetch('/api/onboarding/profile-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alliance_id: selectedAlliance.id,
        governor_name: governorName,
        player_id: playerId,
        requested_role: rank,
      }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed'); return }
    setSubmittedMsg(LEADER_RANKS.includes(rank)
      ? "R4/R5 rank requests are reviewed by your alliance's R5 — or by System Admin if your alliance doesn't have an R5 yet. You will be notified once approved."
      : 'Your profile request has been sent for approval. You will have access once an R4 or R5 approves your request.')
    setStep('submitted')
  }

  async function submitKingdomRequest(type: 'new_kingdom' | 'new_alliance') {
    setLoading(true); setError('')
    const res = await fetch('/api/onboarding/kingdom-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_type: type,
        kingdom_number: type === 'new_kingdom' ? parseInt(serverNumber) : (kingdom?.server_number ?? null),
        kingdom_name: type === 'new_kingdom' ? newKingdomName : (kingdom?.name ?? null),
        kingdom_id: type === 'new_alliance' ? kingdom?.id : null,
        alliance_name: allianceName,
        alliance_tag: allianceTag,
        governor_name: governorName,
        player_id: playerId,
        requested_role: rank,
      }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed'); return }
    setSubmittedMsg(type === 'new_kingdom'
      ? `Your request to register Kingdom ${serverNumber} and Alliance [${allianceTag.toUpperCase()}] has been submitted. System Admin will review and approve your request.`
      : `New alliance creation requires System Admin approval. Your request for [${allianceTag.toUpperCase()}] has been submitted.`)
    setStep('submitted')
  }

  // ---------- RENDER ----------
  if (step === 'submitted') {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <CheckCircle className="mx-auto text-green-400" size={40} />
          <h2 className="text-xl font-bold">Request submitted</h2>
          <p className="text-slate-400 max-w-md mx-auto">{submittedMsg}</p>
        </CardContent>
      </Card>
    )
  }

  const rankSelect = (allowed: string[]) => (
    <div>
      <label className="text-sm text-slate-400 block mb-1">Rank</label>
      <select
        value={rank}
        onChange={e => setRank(e.target.value)}
        className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        {allowed.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* STEP 1 — SEARCH */}
      {step === 'search' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Search size={18} className="text-amber-500" />Find your Kingdom</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm text-slate-400 block">Enter your Kingdom (Server) number</label>
            <div className="flex gap-2">
              <Input type="text" inputMode="numeric" placeholder="e.g. 1511" value={serverNumber}
                onChange={e => setServerNumber(e.target.value.replace(/[^0-9]/g, ''))} />
              <Button onClick={searchKingdom} disabled={loading || !serverNumber}>{loading ? 'Searching…' : 'Search'}</Button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* STEP 2 — SELECT ALLIANCE */}
      {step === 'select_alliance' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown size={18} className="text-amber-500" />{kingdom?.name}{kingdom?.server_number ? ` #${kingdom.server_number}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-400">Select your alliance:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {alliances.map(a => (
                <button key={a.id} onClick={() => { setSelectedAlliance(a); setRank('r3'); setStep('claim_or_create') }}
                  className="text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-lg p-3 transition-colors">
                  <p className="font-semibold text-amber-400">[{a.tag}]</p>
                  <p className="text-sm text-slate-300">{a.name}</p>
                  <span className="text-xs text-amber-500 mt-1 inline-block">Join {a.name} →</span>
                </button>
              ))}
              {alliances.length === 0 && <p className="text-slate-400 text-sm col-span-2">No alliances registered under this kingdom yet.</p>}
            </div>
            <button onClick={() => { setAllianceName(''); setAllianceTag(''); setRank('r4'); setStep('new_alliance') }}
              className="text-sm text-amber-500 hover:text-amber-400">My alliance is not listed →</button>
            <div>
              <button onClick={() => setStep('search')} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><ArrowLeft size={12} />Back to search</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3a — CLAIM OR CREATE */}
      {step === 'claim_or_create' && selectedAlliance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={18} className="text-amber-500" />
              [{selectedAlliance.tag}] {selectedAlliance.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileClaimStep
              allianceId={selectedAlliance.id}
              allianceName={`[${selectedAlliance.tag}] ${selectedAlliance.name}`}
              onClaimed={() => {
                setSubmittedMsg('Your claim request has been sent to your alliance R4/R5 for verification. You will be notified once approved.')
                setStep('submitted')
              }}
              onSkip={() => setStep('create_profile')}
            />
            <div className="mt-3">
              <button onClick={() => setStep('select_alliance')} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                <ArrowLeft size={12} />Back to alliance selection
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3b — CREATE PROFILE (existing alliance) */}
      {step === 'create_profile' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users size={18} className="text-amber-500" />Create your profile — [{selectedAlliance?.tag}] {selectedAlliance?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Governor Name *</label>
              <Input value={governorName} onChange={e => setGovernorName(e.target.value)} placeholder="Your in-game name" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Player ID (optional)</label>
              <Input value={playerId} onChange={e => setPlayerId(e.target.value)} placeholder="In-game numeric ID" />
            </div>
            {rankSelect(RANKS)}
            {LEADER_RANKS.includes(rank)
              ? <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">R4/R5 rank requests require System Admin verification.</p>
              : <p className="text-xs text-slate-500">R1–R3 requests are approved by your alliance's R4/R5.</p>}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={submitProfileRequest} disabled={loading || !governorName}>{loading ? 'Submitting…' : 'Submit Request'}</Button>
              <Button variant="ghost" onClick={() => setStep('select_alliance')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NEW KINGDOM FLOW */}
      {step === 'new_kingdom' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Crown size={18} className="text-amber-500" />Register Kingdom {serverNumber}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-400">This kingdom is not in the system yet. Register it along with your alliance.</p>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Kingdom Number *</label>
              <Input type="text" inputMode="numeric" value={serverNumber} onChange={e => setServerNumber(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Kingdom Name *</label>
              <Input value={newKingdomName} onChange={e => setNewKingdomName(e.target.value)} placeholder="Kingdom name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Alliance Name *</label>
                <Input value={allianceName} onChange={e => setAllianceName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Alliance Tag (3) *</label>
                <Input maxLength={4} value={allianceTag} onChange={e => setAllianceTag(e.target.value.toUpperCase())} placeholder="ABC" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Governor Name *</label>
              <Input value={governorName} onChange={e => setGovernorName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Player ID *</label>
              <Input value={playerId} onChange={e => setPlayerId(e.target.value)} />
            </div>
            {rankSelect(LEADER_RANKS)}
            <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">New kingdom and alliance creation requires System Admin verification. Admin will confirm your rank before approving.</p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={() => submitKingdomRequest('new_kingdom')} disabled={loading || !serverNumber || !newKingdomName || !allianceName || !allianceTag || !governorName || !playerId}>{loading ? 'Submitting…' : 'Submit Request'}</Button>
              <Button variant="ghost" onClick={() => setStep('search')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NEW ALLIANCE FLOW (kingdom exists) */}
      {step === 'new_alliance' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Shield size={18} className="text-amber-500" />Register a new alliance under {kingdom?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Alliance Name *</label>
                <Input value={allianceName} onChange={e => setAllianceName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Alliance Tag (3) *</label>
                <Input maxLength={4} value={allianceTag} onChange={e => setAllianceTag(e.target.value.toUpperCase())} placeholder="ABC" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Governor Name *</label>
              <Input value={governorName} onChange={e => setGovernorName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Player ID *</label>
              <Input value={playerId} onChange={e => setPlayerId(e.target.value)} />
            </div>
            {rankSelect(LEADER_RANKS)}
            <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">New alliance creation requires System Admin approval.</p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={() => submitKingdomRequest('new_alliance')} disabled={loading || !allianceName || !allianceTag || !governorName || !playerId}>{loading ? 'Submitting…' : 'Submit Request'}</Button>
              <Button variant="ghost" onClick={() => setStep('select_alliance')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
