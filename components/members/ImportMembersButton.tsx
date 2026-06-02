// @ts-nocheck
'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Download, X, FileText, CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'

const TEMPLATE_CSV =
  `game_id,player_name,power,troop_count,march_size,rally_capacity,timezone,notes\r\n12345678,IdahoPotato,131195663,772900,142210,1059210,UTC,R4 main account\r\n87654321,,45000000,400000,95000,500000,EST,\r\n22334455,CaptainFrost,22000000,,,,,New member`

const EXPECTED_COLUMNS = ['game_id', 'player_name', 'power', 'troop_count', 'march_size', 'rally_capacity', 'timezone', 'notes']

// kingshot.net rate limit — fetch at most 6 player names per minute.
const RATE_LIMIT_PER_MIN = 6

interface ParsedRow {
  raw: Record<string, string>
  error?: string
}

// Per-game_id name resolution state for CSV rows without a player_name override.
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

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

  return lines.slice(1).map(line => {
    // Basic CSV parsing (handles quoted fields)
    const values: string[] = []
    let inQuote = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current.trim())

    const raw: Record<string, string> = {}
    headers.forEach((h, i) => { raw[h] = values[i] ?? '' })

    // game_id (Player ID) is the ONLY required field now.
    const gameId = (raw.game_id || '').trim()
    if (!gameId) return { raw, error: 'game_id (Player ID) is required' }
    return { raw }
  })
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
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: ImportedRow[]; skipped: SkippedRow[] } | null>(null)
  const [importError, setImportError] = useState('')
  // Name lookups keyed by game_id, plus overall fetch progress.
  const [nameFetch, setNameFetch] = useState<NameFetchState>({})
  const [fetchProgress, setFetchProgress] = useState<{ done: number; total: number } | null>(null)

  // Detect duplicates within the uploaded file itself — keyed by game_id (identity).
  const seenIds = new Set<string>()
  const rowsWithDuplicates: ParsedRow[] = rows.map(r => {
    if (r.error) return r
    const id = (r.raw.game_id || '').trim()
    if (seenIds.has(id)) return { ...r, error: 'Duplicate Player ID within file' }
    seenIds.add(id)
    return r
  })

  const validRows = rowsWithDuplicates.filter(r => !r.error)
  const errorRows = rowsWithDuplicates.filter(r => r.error)

  // Resolve the effective name for a row: CSV player_name overrides the fetched
  // name; otherwise use the fetched name; otherwise blank (flagged with a warning).
  function resolveName(r: ParsedRow): { name: string; fetching: boolean; warning: boolean } {
    const csvName = (r.raw.player_name || '').trim()
    if (csvName) return { name: csvName, fetching: false, warning: false }
    const id = (r.raw.game_id || '').trim()
    const f = nameFetch[id]
    if (!f || f.status === 'fetching') return { name: '', fetching: true, warning: false }
    if (f.status === 'done' && f.name) return { name: f.name, fetching: false, warning: false }
    return { name: '', fetching: false, warning: true }
  }

  const isFetchingNames = fetchProgress !== null && fetchProgress.done < fetchProgress.total

  // When a file is parsed, fetch missing names from the game API (rate-limited).
  useEffect(() => {
    let cancelled = false

    const idsToFetch = Array.from(new Set(
      rowsWithDuplicates
        .filter(r => !r.error && !(r.raw.player_name || '').trim() && (r.raw.game_id || '').trim())
        .map(r => (r.raw.game_id || '').trim())
    ))

    if (idsToFetch.length === 0) {
      setNameFetch({})
      setFetchProgress(null)
      return
    }

    setNameFetch(Object.fromEntries(idsToFetch.map(id => [id, { status: 'fetching' as const }])))
    setFetchProgress({ done: 0, total: idsToFetch.length })

    const callTimes: number[] = []
    ;(async () => {
      let done = 0
      for (const id of idsToFetch) {
        if (cancelled) return

        // Rate limit: allow a burst of RATE_LIMIT_PER_MIN, then throttle so we
        // never exceed that many calls in any rolling 60-second window.
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
          if (res.ok) {
            const json = await res.json()
            name = (json.data?.name || '').trim()
          }
        } catch {
          // network error — treated as a failed lookup below
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
    setFileName(file.name)
    setResult(null)
    setImportError('')
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file)
    }
  }

  async function doImport() {
    setImporting(true)
    setImportError('')
    const res = await fetch('/api/members/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Override player_name with the resolved (fetched/override) name per row.
      body: JSON.stringify({
        alliance_id: allianceId,
        rows: validRows.map(r => ({ ...r.raw, player_name: resolveName(r).name })),
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
    setRows([])
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
    setRows([])
    setFileName('')
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
              Import Members from CSV
            </CardTitle>
            <button onClick={close} className="text-slate-400 hover:text-slate-200">
              <X size={20} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template download */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="border border-slate-700 text-sm"
              onClick={() => downloadCSV(TEMPLATE_CSV, 'member_import_template.csv')}
            >
              <Download size={14} className="mr-1" />
              Download CSV Template
            </Button>
            <span className="text-xs text-slate-500">
              game_id (Player ID) is required. Player name will be fetched automatically from the game. All other fields are optional.
            </span>
          </div>

          {/* Success state */}
          {result && (
            <div className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-300">
                    Successfully imported {result.imported.length} member{result.imported.length !== 1 ? 's' : ''}
                    {result.skipped.length > 0 ? `, skipped ${result.skipped.length} row${result.skipped.length !== 1 ? 's' : ''}` : ''}
                  </p>
                </div>
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
          )}

          {/* Upload area */}
          {!result && (
            <>
              <div
                className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors"
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
              >
                <FileText size={32} className="mx-auto text-slate-600 mb-2" />
                {fileName ? (
                  <p className="text-sm font-medium text-amber-400">{fileName}</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-400">Drag & drop your CSV here, or click to browse</p>
                    <p className="text-xs text-slate-500 mt-1">Accepted: .csv files</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
              </div>

              {/* Preview */}
              {rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">
                    <span className="text-white font-medium">{validRows.length}</span> member{validRows.length !== 1 ? 's' : ''} ready to import
                    {errorRows.length > 0 && (
                      <>, <span className="text-red-400 font-medium">{errorRows.length}</span> row{errorRows.length !== 1 ? 's' : ''} with errors (will be skipped)</>
                    )}
                  </p>

                  {/* Name-fetch progress (rate-limited to 6/min) */}
                  {isFetchingNames && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      <Loader2 size={14} className="animate-spin flex-shrink-0" />
                      Fetching player names from the game… {fetchProgress!.done}/{fetchProgress!.total}
                      <span className="text-slate-500">(rate-limited to {RATE_LIMIT_PER_MIN}/min)</span>
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700 bg-slate-900 sticky top-0">
                          <th className="text-left py-2 px-3">Game ID</th>
                          <th className="text-left py-2 px-3">Player Name</th>
                          <th className="text-right py-2 px-3">Power</th>
                          <th className="text-left py-2 px-3">TZ</th>
                          <th className="text-left py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsWithDuplicates.map((r, i) => {
                          const res = r.error ? null : resolveName(r)
                          const id = (r.raw.game_id || '').trim()
                          return (
                            <tr key={i} className={`border-b border-slate-800 ${r.error ? 'bg-red-950/30' : res?.warning ? 'bg-amber-950/20' : ''}`}>
                              <td className="py-1.5 px-3 text-slate-300 font-medium">{r.raw.game_id || <em className="text-slate-500">missing</em>}</td>
                              <td className="py-1.5 px-3 font-medium">
                                {r.error ? (
                                  r.raw.player_name || <em className="text-slate-500">—</em>
                                ) : res!.fetching ? (
                                  <span className="text-amber-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" />Fetching name…</span>
                                ) : res!.name ? (
                                  res!.name
                                ) : (
                                  <em className="text-slate-500">no name</em>
                                )}
                              </td>
                              <td className="py-1.5 px-3 text-right text-slate-400">{r.raw.power || '—'}</td>
                              <td className="py-1.5 px-3 text-slate-400">{r.raw.timezone || 'UTC'}</td>
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
                    disabled={importing || validRows.length === 0 || isFetchingNames}
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
