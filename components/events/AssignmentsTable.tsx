import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Sword, Users, Clock } from 'lucide-react'

interface Props {
  assignments: any[]
  title?: string
  filter?: (a: any) => boolean
  showCards?: boolean
}

const roleVariant = (role: string) => {
  if (role.includes('leader')) return 'amber'
  if (role.includes('joiner')) return 'blue'
  if (role.includes('support')) return 'green'
  if (role.includes('backup')) return 'default'
  return 'default'
}

const roleIcon = (role: string) => {
  if (role.includes('leader')) return <Sword size={12} className="text-amber-400" />
  if (role.includes('joiner')) return <Users size={12} className="text-blue-400" />
  if (role.includes('support')) return <Shield size={12} className="text-green-400" />
  return null
}

export function AssignmentsTable({ assignments, title = 'Assignments', filter, showCards }: Props) {
  const data = filter ? assignments.filter(filter) : assignments
  if (data.length === 0) return null

  const leaders = data.filter(a => a.role.includes('leader') && !a.is_backup)
  const joiners = data.filter(a => a.role.includes('joiner') && !a.is_backup)
  const support = data.filter(a => a.role.includes('support'))
  const backups = data.filter(a => a.is_backup)
  const other = data.filter(a => !leaders.includes(a) && !joiners.includes(a) && !support.includes(a) && !backups.includes(a))

  const groups = [
    { label: 'Rally Leaders', items: leaders },
    { label: 'Joiners', items: joiners },
    { label: 'Support', items: support },
    { label: 'Other', items: other },
    { label: 'Backups', items: backups },
  ].filter(g => g.items.length > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            {groups.length > 1 && (
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">{group.label}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              {group.items.map(a => (
                <div key={a.id} className={`bg-slate-800 rounded-xl p-3 border ${a.is_backup ? 'border-slate-700' : 'border-slate-700/60'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {roleIcon(a.role)}
                      <span className="font-semibold text-sm truncate">{(a.members as any)?.player_name}</span>
                      {a.is_backup && <span className="text-[10px] text-slate-500 flex-shrink-0">(backup)</span>}
                    </div>
                    <Badge variant={roleVariant(a.role)} className="flex-shrink-0 text-[10px]">
                      {a.role.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {a.reasoning && (
                    <p className="text-xs text-slate-400 leading-relaxed">{a.reasoning}</p>
                  )}
                  {(a.time_window_start || a.time_window_end) && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                      <Clock size={10} />
                      {a.time_window_start ? new Date(a.time_window_start).toLocaleString(undefined, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) : '—'}
                      {' → '}
                      {a.time_window_end ? new Date(a.time_window_end).toLocaleString(undefined, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) : '—'} UTC
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
