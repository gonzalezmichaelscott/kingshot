// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, Plus, Trash2, Pencil, X, Coins, AlertTriangle } from 'lucide-react'
import { troopTypeColor } from '@/lib/utils'
import { getHeroStatBonus } from '@/lib/scoring'

const SKILL_LABELS: Record<number, string> = {
  1: 'Skill 1 — Joiner Skill (applies when joining AND leading)',
  2: 'Skill 2 — Leader Only',
  3: 'Skill 3 — Leader Only',
}

/**
 * Build the stat-bonus label shown on a saved hero card.
 * - Economy heroes: no combat value.
 * - Heroes without stat data (e.g. Gen 7): pending.
 * - Otherwise: exact Attack/Defense % from the star/shard lookup table.
 */
function statBonusLabel(hero: any, starLevel: number, starShards: number) {
  if (hero?.is_economy_hero) {
    return { kind: 'economy' as const, text: 'Economy Hero — No combat bonus' }
  }
  const sb = hero?.stat_bonuses
  const hasData = sb && typeof sb === 'object' && Object.keys(sb).length > 0
  if (!hasData) return { kind: 'pending' as const, text: 'Stat data pending' }
  const bonus = getHeroStatBonus(sb, starLevel || 0, starShards || 0)
  return { kind: 'value' as const, text: `Stat Bonus: +${bonus.toFixed(2)}% ATK/DEF` }
}

interface Props {
  accessToken: string
  memberHeroes: any[]
  heroes: any[]
}

function numFromText(v: string, min: number, max: number, fallback: number) {
  if (v === '') return ''
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
  if (Number.isNaN(n)) return ''
  return Math.max(min, Math.min(max, n))
}

export function HeroManager({ accessToken, memberHeroes, heroes }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<null | 'new' | string>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const heroById = (id: string) => heroes.find(h => h.id === id)

  // Catalog split for the dropdown: Combat Heroes vs Economy Heroes.
  const combatCatalog = heroes
    .filter(h => !h.is_economy_hero)
    .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name))
  const economyCatalog = heroes
    .filter(h => h.is_economy_hero)
    .sort((a, b) => a.name.localeCompare(b.name))

  // Warn when the member has heroes but none of them are combat heroes.
  const combatHeroCount = memberHeroes.filter((mh: any) => !mh.heroes?.is_economy_hero).length
  const onlyEconomyHeroes = memberHeroes.length > 0 && combatHeroCount === 0

  const blankForm = {
    member_hero_id: null as string | null,
    hero_id: heroes[0]?.id || '',
    hero_level: 1 as number | '',
    star_level: 0,
    star_shards: 0 as number | '',
    widget_unlocked: false,
    widget_level: 0 as number | '',
    is_primary: false,
    skills: {} as Record<string, number | ''>,
  }
  const [form, setForm] = useState(blankForm)

  function startAdd() {
    setError('')
    setForm(blankForm)
    setEditing('new')
  }

  function startEdit(mh: any) {
    setError('')
    const skills: Record<string, number> = {}
    const levels = mh.expedition_skill_levels || {}
    for (const [k, v] of Object.entries(levels)) skills[k] = v as number
    setForm({
      member_hero_id: mh.id,
      hero_id: mh.hero_id,
      hero_level: mh.hero_level ?? 1,
      star_level: mh.star_level ?? 0,
      star_shards: mh.star_shards ?? 0,
      widget_unlocked: mh.widget_unlocked ?? false,
      widget_level: mh.widget_level ?? 0,
      is_primary: mh.is_primary ?? false,
      skills,
    })
    setEditing(mh.id)
  }

  const selectedHero = heroById(form.hero_id)
  const isEconomy = !!selectedHero?.is_economy_hero
  const hasWidget = !!selectedHero?.has_widget
  const baseSkillCount = selectedHero?.expedition_skill_count || (hasWidget ? 3 : 2)
  // Expedition skills are slots 1..3 for Mythic, 1..2 for Epic. The widget is
  // captured separately by the "Widget Level" field above — it is NOT a skill
  // slot, so there is no slot 4 here. Economy heroes have no combat skills worth
  // tracking, so they get no skill slots at all.
  const skillSlots: number[] = []
  if (!isEconomy) {
    for (let s = 1; s <= Math.min(baseSkillCount, 3); s++) skillSlots.push(s)
  }

  function skillName(slot: number): string {
    const sk = (selectedHero?.expedition_skills as any[])?.find(s => s.slot === slot)
    return sk?.name ? ` · ${sk.name}` : ''
  }

  async function save() {
    setSaving(true)
    setError('')
    const skills: Record<string, number> = {}
    for (const slot of skillSlots) {
      const v = form.skills[String(slot)]
      skills[String(slot)] = v === '' || v === undefined ? 0 : (v as number)
    }
    const res = await fetch('/api/member/heroes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        hero_id: form.hero_id,
        hero_level: form.hero_level === '' ? 1 : form.hero_level,
        star_level: form.star_level,
        star_shards: form.star_shards === '' ? 0 : form.star_shards,
        widget_unlocked: hasWidget ? form.widget_unlocked : false,
        widget_level: hasWidget && form.widget_unlocked ? (form.widget_level === '' ? 0 : form.widget_level) : 0,
        expedition_skill_levels: skills,
        is_primary: form.is_primary,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Save failed')
      return
    }
    setEditing(null)
    router.refresh()
  }

  async function remove(mh: any) {
    if (!confirm(`Remove ${mh.heroes?.name || 'this hero'}?`)) return
    const res = await fetch('/api/member/heroes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, member_hero_id: mh.id }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Warning when the member has only economy heroes */}
      {onlyEconomyHeroes && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">
            No combat heroes entered — battle plan recommendations will be limited.
          </p>
        </div>
      )}

      {/* Existing hero cards */}
      {memberHeroes.map((mh: any) => {
        const h = mh.heroes
        const levels = mh.expedition_skill_levels || {}
        const isEco = !!h?.is_economy_hero
        const statLabel = statBonusLabel(h, mh.star_level, mh.star_shards)
        return (
          <Card key={mh.id}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{h?.name}</span>
                    <Badge variant="default">Gen {h?.generation}</Badge>
                    {h?.rarity && (
                      <Badge variant={h.rarity === 'mythic' ? 'amber' : 'blue'}>{h.rarity}</Badge>
                    )}
                    {isEco && (
                      <Badge variant="default" className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <Coins size={11} className="mr-1" />Economy
                      </Badge>
                    )}
                    {mh.is_primary && <Badge variant="green">Primary</Badge>}
                  </div>
                  <div className="flex gap-3 text-xs text-slate-400 flex-wrap mt-1.5">
                    {h?.troop_type && <span className={troopTypeColor(h.troop_type)}>{h.troop_type}</span>}
                    <span className="text-amber-400">
                      {'★'.repeat(mh.star_level || 0)}{'☆'.repeat(Math.max(0, 5 - (mh.star_level || 0)))}
                    </span>
                    {(mh.star_shards || 0) > 0 && <span>{mh.star_shards}/6 shards</span>}
                    <span>Lvl {mh.hero_level}</span>
                    {h?.has_widget && mh.widget_unlocked && <span className="text-purple-400">Widget Lv {mh.widget_level}</span>}
                  </div>
                  {/* Stat bonus (value of upgrading) */}
                  <p className={`text-xs mt-1.5 ${
                    statLabel.kind === 'value' ? 'text-amber-400 font-medium'
                      : statLabel.kind === 'economy' ? 'text-emerald-300'
                      : 'text-slate-500 italic'
                  }`}>
                    {statLabel.text}
                  </p>
                  {!isEco && Object.keys(levels).length > 0 && (
                    <div className="flex gap-2 text-[11px] text-slate-500 flex-wrap mt-1">
                      {Object.entries(levels).map(([slot, lvl]) => (
                        <span key={slot} className="bg-slate-800 rounded px-1.5 py-0.5">S{slot}: {lvl as number}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(mh)} className="p-1.5 text-slate-400 hover:text-amber-400" aria-label="Edit hero">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(mh)} className="p-1.5 text-slate-400 hover:text-red-400" aria-label="Remove hero">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Add / Edit form */}
      {editing ? (
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{editing === 'new' ? 'Add Hero' : 'Edit Hero'}</p>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
            </div>

            {/* Hero selector grouped by generation */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Hero</label>
              <select
                value={form.hero_id}
                onChange={e => setForm(f => ({ ...f, hero_id: e.target.value, skills: {}, widget_unlocked: false }))}
                disabled={editing !== 'new'}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
              >
                <optgroup label="Combat Heroes">
                  {combatCatalog.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} (Gen {h.generation}{h.troop_type ? `, ${h.troop_type}` : ''})
                    </option>
                  ))}
                </optgroup>
                {economyCatalog.length > 0 && (
                  <optgroup label="Economy Heroes">
                    {economyCatalog.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} (Gen {h.generation}{h.troop_type ? `, ${h.troop_type}` : ''})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Hero level 1-80 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hero Level (1–80)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.hero_level}
                  onChange={e => setForm(f => ({ ...f, hero_level: numFromText(e.target.value, 1, 80, 1) }))}
                />
              </div>
              {/* Shards 0-6 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">{(form.star_shards || 0)}/6 shards toward next star</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.star_shards}
                  onChange={e => setForm(f => ({ ...f, star_shards: numFromText(e.target.value, 0, 6, 0) }))}
                />
              </div>
            </div>

            {/* Stars 0-5 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Stars</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, star_level: f.star_level === n ? n - 1 : n }))}
                    className="p-0.5"
                    aria-label={`Set ${n} stars`}
                  >
                    <Star
                      size={22}
                      className={n <= form.star_level ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Widget (only for heroes that have one) */}
            {hasWidget && (
              <div className="space-y-2 bg-slate-800/50 rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.widget_unlocked}
                    onChange={e => setForm(f => ({ ...f, widget_unlocked: e.target.checked }))}
                    className="accent-amber-500"
                  />
                  <span className="text-sm">Widget unlocked</span>
                </label>
                {form.widget_unlocked && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Widget Level (0–10)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.widget_level}
                      onChange={e => setForm(f => ({ ...f, widget_level: numFromText(e.target.value, 0, 10, 0) }))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Economy heroes: no combat skills to track */}
            {isEconomy ? (
              <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <Coins size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-200">
                  This hero provides no combat bonus. Their expedition skills boost resource gathering only.
                </p>
              </div>
            ) : (
              /* Expedition skills */
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-300">Expedition Skills</p>
                {skillSlots.map(slot => (
                  <div key={slot} className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 flex-1 min-w-0">
                      {SKILL_LABELS[slot]}<span className="text-slate-500">{skillName(slot)}</span>
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.skills[String(slot)] ?? ''}
                      placeholder="0"
                      onChange={e => {
                        const v = numFromText(e.target.value, 0, 5, 0)
                        setForm(f => ({ ...f, skills: { ...f.skills, [String(slot)]: v } }))
                      }}
                      className="w-16 h-8 text-xs text-center"
                    />
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
                className="accent-amber-500"
              />
              <span className="text-sm">Primary hero</span>
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Hero'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="secondary" className="w-full" onClick={startAdd}>
          <Plus size={16} className="mr-2" /> Add Hero
        </Button>
      )}
    </div>
  )
}
