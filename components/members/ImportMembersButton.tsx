// @ts-nocheck
'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Download, X, CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'

// FIX 6 — bulk import accepts Player IDs ONLY. The CSV template is a single
// column (no header) and players can also be pasted into a textarea.
const MAX_ROWS = 115
const TEMPLATE_CSV = `12345678\r\n87654321\r\n22334455`

// kingshot.net rate limit — fetch at most 6 player names per minute.
const RATE_LIMIT_PER_MIN = 6

interface ParsedRow {
  raw: { game_id: string }
  error?: string
}

// Per-game_id name resolution state.
type NameFetchState = Record<string, { status: 'fetching' | 'done' | 'failed'; name?: string }>

function fetchWarning(id: string) {
  return `Could not fetch name for Player ID ${id} — you can add it manually later`
}

interface ImportedRow {
  player_name: string
  game_id: string
  self_service_link: string
}

interface SkippedRow {
  player_name: string
  reason: string
}

// Parse free text (textarea or CSV file) into Player ID rows: one ID per line.
// Tolerant of a single-column CSV (takes the first comma-separated field) and of
// blank lines. Each ID is validated as numeric, max 9 digits.
function parseIds(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows: ParsedRow[] = []
  for (const line of lines) {
    const first = line.split(',')[0].trim()
    if (!first) continue
    const id = first.replace(/[^0-9]/g, '')
    if (!id) {
      rows.push({ raw: { game_id: first }, error: 'Not a numeric Player ID' })
    } else if (id.length > 9) {
      rows.push({ raw: { game_id: id }, error: 'Player ID too long (max 9 digits)' })
    } else {
      rows.push({ raw: { game_id: id } })
    }
  }
  return rows
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  allianceId: string
}

export function ImportMembersButton({ allianceId }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: ImportedRow[]; skipped: SkippedRow[] } | null>(null)
  const [importError, setImportError] = useState('')
  // Name lookups keyed by game_id, plus overall fetch progress.
  const [nameFetch, setNameFetch] = useState<NameFetchState>({})
  const [fetchProgress, setFetchProgress] = useState<{ done: number; total: number } | null>(null)
  // True once the name lookup API returns 429 — remaining rows skip the fetch.
  const [rateLimitedNames, setRateLimitedNames] = useState(false)

  // Re-parse whenever the text changes, flagging in-file duplicates.
  useEffect(() => {
    const parsed = parseIds(text)
    const seen = new Set<string>()
    const withDupes = parsed.map(r => {
      if (r.error) return r
      const id = r.raw.game_id
      if (seen.has(id)) return { ...r, error: 'Duplicate Player ID' }
      seen.add(id)
      return r
    })
    setRows(withDupes)
  }, [text])

  const validRows = rows.filter(r => !r.error)
  const errorRows = rows.filter(r => r.error)
  const tooMany = validRows.length > MAX_ROWS

  // Resolve the fetched name for an ID (blank with a warning if the lookup failed).
  function resolveName(id: string): { name: string; fetching: boolean; warning: boolean } {
    const f = nameFetch[id]
    if (!f || f.status === 'fetching') return { name: '', fetching: true, warning: false }
    if (f.status === 'done' && f.name) return { name: f.name, fetching: false, warning: false }
    return { name: '', fetching: false, warning: true }
  }

  const isFetchingNames = fetchProgress !== null && fetchProgress.done < fetchProgress.total

  // Fetch player names from the game API (rate-limited) whenever the IDs change.
  useEffect(() => {
    let cancelled = false

    const idsToFetch = Array.from(new Set(validRows.map(r => r.raw.game_id)))

    if (idsToFetch.length === 0) {
      setNameFetch({})
      setFetchProgress(null)
      return
    }

    setNameFetch(Object.fromEntries(idsToFetch.map(id => [id, { status: 'fetching' as const }])))
    setFetchProgress({ done: 0, total: idsToFetch.length })
    setRateLimitedNames(false)

    const callTimes: number[] = []
    ;(async () => {
      let done = 0
      let rateLimitHit = false
      for (const id of idsToFetch) {
        if (cancelled) return

        if (rateLimitHit) {
          setNameFetch(prev => ({ ...prev, [id]: { status: 'failed' } }))
          done++
          setFetchProgress({ done, total: idsToFetch.length })
          continue
        }

        // Throttle: never exceed RATE_LIMIT_PER_MIN calls in any rolling minute.
        const now = Date.now()
        while (callTimes.length && now - callTimes[0] > 60000) callTimes.shift()
        if (callTimes.length >= RATE_LIMIT_PER_MIN) {
          const waitMs = 60000 - (Date.now() - callTimes[0]) + 50
          await new Promise(res => setTimeout(res, waitMs))
        }
        callTimes.push(Date.now())

        let name = ''
        try {
          const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(id)}`)
          if (res.status === 429) {
            rateLimitHit = true
            setRateLimitedNames(true)
          } else if (res.ok) {
            const json = await res.json()
            name = (json.data?.name || '').trim()
          }
        } catch {
          // network error — treated as a failed lookup
        }
        if (cancelled) return

        setNameFetch(prev => ({ ...prev, [id]: name ? { status: 'done', name } : { status: 'failed' } }))
        done++
        setFetchProgress({ done, total: idsToFetch.length })
      }
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  function handleFile(file: File) {
    setResult(null)
    setImportError('')
    if (file.size > 5 * 1024 * 1024) {
      setImportError('File is too large — maximum size is 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const fileText = (e.target?.result as string) || ''
      // Append the file's IDs to whatever is already in the textarea.
      setText(prev => (prev.trim() ? prev.replace(/\s*$/, '') + '\n' : '') + fileText.trim())
    }
    reader.readAsText(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  async function doImport() {
    setImporting(true)
    setImportError('')
    const res = await fetch('/api/members/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alliance_id: allianceId,
        rows: validRows.map(r => ({ game_id: r.raw.game_id, player_name: resolveName(r.raw.game_id).name })),
      }),
    })
    setImporting(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setImportError(d.error || 'Import failed')
      return
    }
    const data = await res.json()
    setResult(data)
    setText('')
    router.refresh()
  }

  function downloadLinks() {
    if (!result) return
    const header = 'player_name,game_id,self_service_link'
    const lines = result.imported.map(r => `${r.player_name},${r.game_id || ''},${r.self_service_link}`)
    downloadCSV([header, ...lines].join('\r\n'), 'member_links.csv')
  }

  function close() {
    setOpen(false)
    setText('')
    setResult(null)
    setImportError('')
    setNameFetch({})
    setFetchProgress(null)
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="border border-slate-700">
        <Upload size={16} className="mr-1" /> Import Members
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl mt-8 mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Upload size={18} className="text-amber-500" />
              Import Members by Player ID
            </CardTitle>
            <button onClick={close} className="text-slate-400 hover:text-slate-200">
              <X size={20} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Success state */}
          {result ? (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                <p className="font-medium text-green-300">
                  Successfully imported {result.imported.length} member{result.imported.length !== 1 ? 's' : ''}
                  {result.skipped.length > 0 ? `, skipped ${result.skipped.length} row${result.skipped.length !== 1 ? 's' : ''}` : ''}
                </p>
              </div>

              {result.imported.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Member Links</p>
                    <Button size="sm" variant="ghost" className="border border-slate-700" onClick={downloadLinks}>
                      <Download size={14} className="mr-1" />
                      Download Member Links CSV
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700 bg-slate-900">
                          <th className="text-left py-2 px-3">Player</th>
                          <th className="text-left py-2 px-3 hidden sm:table-cell">Game ID</th>
                          <th className="text-left py-2 px-3">Self-Service Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.imported.map((r, i) => (
                          <tr key={i} className="border-b border-slate-800">
                            <td className="py-1.5 px-3 font-medium">{r.player_name || <em className="text-slate-500">no name</em>}</td>
                            <td className="py-1.5 px-3 text-slate-400 hidden sm:table-cell">{r.game_id || '—'}</td>
                            <td className="py-1.5 px-3">
                              <div className="flex items-center gap-2">
                                <code className="text-slate-300 truncate max-w-[200px] block">{r.self_service_link}</code>
                                <button
                                  onClick={() => navigator.clipboard.writeText(r.self_service_link)}
                                  className="text-amber-400 hover:text-amber-300 flex-shrink-0 text-xs"
                                >
                                  Copy
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.skipped.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-slate-400">Skipped rows:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.skipped.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-400">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span className="font-medium">{r.player_name}</span>
                        <span className="text-slate-500">— {r.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full" variant="ghost" onClick={close}>Close</Button>
            </div>
          ) : (
            <>
              {/* Instructions */}
              <p className="text-sm text-slate-400">
                Enter one Player ID per line, up to {MAX_ROWS} players. Player names are fetched
                automatically from the game — if a lookup fails, the member is created with an empty
                name you can fill in later.
              </p>

              {/* Textarea input */}
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={"12345678\n87654321\n22334455"}
                rows={8}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
              />

              {/* File upload + template alternatives */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="border border-slate-700 text-sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={14} className="mr-1" />
                  Upload CSV file
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="border border-slate-700 text-sm"
                  onClick={() => downloadCSV(TEMPLATE_CSV, 'player_ids_template.csv')}
                >
                  <Download size={14} className="mr-1" />
                  Download CSV Template
                </Button>
                <span className="text-xs text-slate-500">One Player ID per line, no header needed.</span>
                <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFileChange} />
              </div>

              {/* Preview */}
              {rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">
                    <span className="text-white font-medium">{validRows.length}</span> Player ID{validRows.length !== 1 ? 's' : ''} ready
                    {errorRows.length > 0 && (
                      <>, <span className="text-red-400 font-medium">{errorRows.length}</span> invalid (will be skipped)</>
                    )}
                  </p>

                  {tooMany && (
                    <p className="text-red-400 text-sm flex items-center gap-1">
                      <AlertTriangle size={14} /> Too many — maximum {MAX_ROWS} players per import.
                    </p>
                  )}

                  {/* Name-fetch progress (rate-limited) */}
                  {isFetchingNames && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      <Loader2 size={14} className="animate-spin flex-shrink-0" />
                      Fetching player names from the game… {fetchProgress!.done}/{fetchProgress!.total}
                      <span className="text-slate-500">(rate-limited to {RATE_LIMIT_PER_MIN}/min)</span>
                    </div>
                  )}

                  {rateLimitedNames && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      <AlertTriangle size={14} className="flex-shrink-0" />
                      Name fetch rate limited — some names not loaded. You can add missing names later.
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700 bg-slate-900 sticky top-0">
                          <th className="text-left py-2 px-3">Player ID</th>
                          <th className="text-left py-2 px-3">Player Name</th>
                          <th className="text-left py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const id = r.raw.game_id
                          const res = r.error ? null : resolveName(id)
                          return (
                            <tr key={i} className={`border-b border-slate-800 ${r.error ? 'bg-red-950/30' : res?.warning ? 'bg-amber-950/20' : ''}`}>
                              <td className="py-1.5 px-3 text-slate-300 font-medium">{id || <em className="text-slate-500">missing</em>}</td>
                              <td className="py-1.5 px-3 font-medium">
                                {r.error ? (
                                  <em className="text-slate-500">—</em>
                                ) : res!.fetching ? (
                                  <span className="text-amber-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" />Fetching name…</span>
                                ) : res!.name ? (
                                  res!.name
                                ) : (
                                  <em className="text-slate-500">no name</em>
                                )}
                              </td>
                              <td className="py-1.5 px-3">
                                {r.error ? (
                                  <span className="text-red-400 flex items-center gap-1"><AlertCircle size={10} />{r.error}</span>
                                ) : res!.fetching ? (
                                  <span className="text-amber-400">Fetching…</span>
                                ) : res!.warning ? (
                                  <span className="text-amber-400 flex items-center gap-1" title={fetchWarning(id)}>
                                    <AlertTriangle size={10} />Name not found — add later
                                  </span>
                                ) : (
                                  <span className="text-green-400">✓</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {importError && <p className="text-red-400 text-sm">{importError}</p>}

                  <Button
                    className="w-full"
                    onClick={doImport}
                    disabled={importing || validRows.length === 0 || isFetchingNames || tooMany}
                  >
                    <Upload size={16} className="mr-2" />
                    {importing
                      ? 'Importing…'
                      : isFetchingNames
                      ? 'Fetching names…'
                      : `Import ${validRows.length} Member${validRows.length !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
