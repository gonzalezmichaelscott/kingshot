'use client'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock } from 'lucide-react'
import { formatUtcDateTime } from '@/lib/utils'

const statusColors: Record<string, 'green' | 'amber' | 'blue' | 'default'> = {
  active: 'green', registration: 'amber', planning: 'blue', completed: 'default',
}

interface Props {
  event: any
  children?: React.ReactNode
}

export function EventHeader({ event, children }: Props) {
  const eventType = event.event_types
  const alliance = event.alliances

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.name || eventType?.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            [{alliance?.tag}] {alliance?.name}
          </p>
        </div>
        <Badge variant={statusColors[event.status]}>{event.status}</Badge>
      </div>

      <div className="flex gap-4 flex-wrap text-sm text-slate-400">
        {event.battle_start_utc && (
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {formatUtcDateTime(event.battle_start_utc)}
          </span>
        )}
        {eventType?.duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {eventType.duration_minutes} min
          </span>
        )}
      </div>

      {event.notes && (
        <p className="text-slate-300 text-sm bg-slate-900 border border-slate-800 rounded-lg p-3">{event.notes}</p>
      )}

      {children}
    </div>
  )
}
