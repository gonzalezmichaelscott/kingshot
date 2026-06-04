// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldAlert, CheckCircle2 } from 'lucide-react'

export function ReportImpersonationForm() {
  const [form, setForm] = useState({ email: '', playerId: '', governorName: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.email.trim() || !form.playerId.trim() || form.description.trim().length < 10) {
      setError('Please fill in your email, Player ID, and a description (at least 10 characters).')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/impersonation/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter_email: form.email.trim(),
          claimed_player_id: form.playerId.trim(),
          claimed_player_name: form.governorName.trim(),
          description: form.description.trim(),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Submission failed. Please try again.'); return }
      setDone(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto text-green-400" size={40} />
        <h2 className="font-semibold text-lg">Report received</h2>
        <p className="text-sm text-slate-400">
          Your report has been received. The System Admin will verify your identity via in-game private message before taking any action.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="text-amber-500" size={22} />
        <h1 className="text-lg font-bold">Report Account Impersonation</h1>
      </div>
      <p className="text-sm text-slate-400">
        Use this form if someone has falsely claimed your in-game profile. The System Admin will verify your
        identity via an in-game private message before taking any action.
      </p>

      <div>
        <label className="text-sm text-slate-400 block mb-1">Your Email <span className="text-red-400">*</span></label>
        <Input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <p className="text-xs text-slate-500 mt-1">The admin will contact you via email and in-game.</p>
      </div>

      <div>
        <label className="text-sm text-slate-400 block mb-1">Your Player ID <span className="text-red-400">*</span></label>
        <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="In-game numeric ID you claim is yours"
          value={form.playerId} onChange={e => setForm(f => ({ ...f, playerId: e.target.value.replace(/[^0-9]/g, '') }))} />
      </div>

      <div>
        <label className="text-sm text-slate-400 block mb-1">Your Governor Name <span className="text-slate-500">(optional)</span></label>
        <Input value={form.governorName} onChange={e => setForm(f => ({ ...f, governorName: e.target.value }))} placeholder="In-game governor name" />
      </div>

      <div>
        <label className="text-sm text-slate-400 block mb-1">Description of the situation <span className="text-red-400">*</span></label>
        <textarea
          rows={5}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Explain what happened and why you believe this profile is yours."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Submitting…' : 'Submit Report'}
      </Button>
    </form>
  )
}
