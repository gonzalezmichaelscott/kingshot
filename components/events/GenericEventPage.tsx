import { EventHeader } from './EventHeader'
import { AvailabilityPanel } from './AvailabilityPanel'
import { AssignmentsTable } from './AssignmentsTable'
import { BattlePlanButton } from './BattlePlanButton'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  event: any
  availability: any[]
  assignments: any[]
  members: any[]
  allianceId: string
  canManage: boolean
  userId?: string
}

export function GenericEventPage({ event, availability, assignments, members, allianceId, canManage }: Props) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <EventHeader event={event} />
      <AvailabilityPanel members={members} availability={availability} allianceId={allianceId} eventId={event.id} />
      {canManage && (
        <Card>
          <CardContent className="py-4">
            <BattlePlanButton eventId={event.id} />
          </CardContent>
        </Card>
      )}
      {assignments.length > 0 && <AssignmentsTable assignments={assignments} />}
    </div>
  )
}
