// @ts-nocheck
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, Download, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react'

const TEMPLATE_CSV =
  `player_name,game_id,power,troop_count,march_size,rally_capacity,timezone,notes\r\nIdahoPotato,12345678,131195663,772900,142210,1059210,UTC,R4 main account\r\nLittleSpud,87654321,45000000,400000,95000,500000,EST,\r\nCaptainFrost,,22000000,,,,,New member`

const EXPECTED_COLUMNS = ['player_name', 'game_id', 'power', 'troop_count', 'march_size', 'rally_capacity', 'timezone', 'notes']

interface ParsedRow {
  raw: Record<string, string>
  error?: string
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

    const name = (raw.player_name || '').trim()
    if (!name) return { raw, error: 'player_name is required' }
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

  // Detect duplicates within the uploaded file itself
  const seenNames = new Set<string>()
  const rowsWithDuplicates: ParsedRow[] = rows.map(r => {
    if (r.error) return r
    const name = (r.raw.player_name || '').toLowerCase().trim()
    if (seenNames.has(name)) return { ...r, error: 'Duplicate within file' }
    seenNames.add(name)
    return r
  })

  const validRows = rowsWithDuplicates.filter(r => !r.error)
  const errorRows = rowsWithDuplicates.filter(r => r.error)

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
      body: JSON.stringify({ alliance_id: allianceId, rows: validRows.map(r => r.raw) }),
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
            <span className="text-xs text-slate-500">Required column: player_name. All others optional.</span>
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
                            <td className="py-1.5 px-3 font-medium">{r.player_name}</td>
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

                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700 bg-slate-900 sticky top-0">
                          <th className="text-left py-2 px-3">Player Name</th>
                          <th className="text-left py-2 px-3">Game ID</th>
                          <th className="text-right py-2 px-3">Power</th>
                          <th className="text-left py-2 px-3">TZ</th>
                          <th className="text-left py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsWithDuplicates.map((r, i) => (
                          <tr key={i} className={`border-b border-slate-800 ${r.error ? 'bg-red-950/30' : ''}`}>
                            <td className="py-1.5 px-3 font-medium">{r.raw.player_name || <em className="text-slate-500">empty</em>}</td>
                            <td className="py-1.5 px-3 text-slate-400">{r.raw.game_id || '—'}</td>
                            <td className="py-1.5 px-3 text-right text-slate-400">{r.raw.power || '—'}</td>
                            <td className="py-1.5 px-3 text-slate-400">{r.raw.timezone || 'UTC'}</td>
                            <td className="py-1.5 px-3">
                              {r.error
                                ? <span className="text-red-400 flex items-center gap-1"><AlertCircle size={10} />{r.error}</span>
                                : <span className="text-green-400">✓</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importError && <p className="text-red-400 text-sm">{importError}</p>}

                  <Button
                    className="w-full"
                    onClick={doImport}
                    disabled={importing || validRows.length === 0}
                  >
                    <Upload size={16} className="mr-2" />
                    {importing ? 'Importing…' : `Import ${validRows.length} Member${validRows.length !== 1 ? 's' : ''}`}
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
