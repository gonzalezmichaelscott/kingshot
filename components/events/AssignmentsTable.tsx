import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  assignments: any[]
  title?: string
  filter?: (a: any) => boolean
}

export function AssignmentsTable({ assignments, title = 'Assignments', filter }: Props) {
  const data = filter ? assignments.filter(filter) : assignments

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="table-scroll">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-2 pr-4">Player</th>
                <th className="text-left py-2 pr-4">Role</th>
                <th className="text-left py-2 pr-4">Squad</th>
                <th className="text-left py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.map(a => (
                <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                  <td className="py-2 pr-4 font-medium">
                    {(a.members as any)?.player_name}
                    {a.is_backup && <span className="text-xs text-slate-500 ml-1">(backup)</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={a.role === 'rally_leader' ? 'amber' : a.role === 'joiner' ? 'blue' : 'default'}>
                      {a.role.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{a.squad || '—'}</td>
                  <td className="py-2 text-slate-400 text-xs max-w-xs truncate">{a.reasoning || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
