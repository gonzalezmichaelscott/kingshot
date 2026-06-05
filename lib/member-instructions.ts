import type { BattlePlan, BattlePlanAssignment } from '@/lib/ai-planner'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'TBD'
  return new Date(iso).toUTCString().slice(0, 16)
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function heroLines(rec: string | undefined): string {
  if (!rec) return '• Your best heroes for this role'
  const parts = rec.split(/[;,]/).map(s => s.trim()).filter(Boolean)
  return parts.length > 1 ? parts.map(p => `• ${p}`).join('\n') : `• ${rec}`
}

function joinerInstructions(
  a: BattlePlanAssignment,
  plan: BattlePlan,
  header: string,
  timeWindow: string,
): string {
  const leader = plan.assignments.find(
    x => x.squad === a.squad && x.role.toLowerCase().includes('leader') && !x.is_backup,
  )
  const squadJoiners = plan.assignments.filter(
    x => x.squad === a.squad && x.role.toLowerCase().includes('joiner') && !x.is_backup,
  )
  const leaderName = a.transfer_rally_leader || leader?.player_name || 'your squad leader'
  const formation = a.formation_recommendation || 'Use your primary troop type'
  const squadLabel = a.squad ? ` (Squad ${a.squad})` : ''

  // FIX 3 — capacity-aware joiner slot line.
  const leaderSpace = leader?._available_joiner_space || 0
  const myMarch = a._march_size || 0
  let slotLine = ''
  if (leader?._rally_incomplete) {
    slotLine = '\nRally capacity data is incomplete — this rally takes up to 15 joiners (the game maximum).'
  } else if (leaderSpace > 0 && myMarch > 0) {
    slotLine = `\nYou are filling approximately ${myMarch.toLocaleString()} of ${leaderSpace.toLocaleString()} available march slots in this rally.`
  }

  const transferBlock = a.kvk_transfer
    ? `\n*** KVK TRANSFER ***
You have been recommended to temporarily join ${a.transfer_alliance || "another alliance"}'s rally.
Coordinate with ${leaderName} to move to their alliance before the battle.
\n`
    : ''

  return `${header}
${transferBlock}
YOUR ROLE: Rally Joiner${squadLabel}
YOUR SQUAD LEADER: ${leaderName}

WHAT TO DO:
Join ${leaderName}'s rally when they launch it. You are one of ${squadJoiners.length} joiners in this squad.${slotLine}

HEROES TO USE:
${heroLines(a.hero_recommendation)}
Keep your lead hero in your FIRST hero slot for maximum rally contribution.
(Joiners: only the first expedition skill of your lead hero applies in a rally.)

TROOPS TO BRING:
${formation}
Bring your highest tier troops — TG troops first, then T10, T9, etc.
Do NOT bring T6 and below — low-tier troops weaken the rally.

TIME WINDOW: ${timeWindow}

NOTES: ${a.reasoning || "Follow your squad leader's instructions."}`
}

function leaderInstructions(
  a: BattlePlanAssignment,
  plan: BattlePlan,
  header: string,
  timeWindow: string,
): string {
  const squadJoiners = plan.assignments.filter(
    x =>
      x.squad === a.squad &&
      x.role.toLowerCase().includes('joiner') &&
      !x.is_backup &&
      x.member_id !== a.member_id,
  )
  const joinerList =
    squadJoiners.length > 0
      ? squadJoiners.map(j => `• ${j.player_name}`).join('\n')
      : '• (No joiners assigned yet)'
  const formation = a.formation_recommendation || '50% Infantry / 20% Cavalry / 30% Archer'
  const squadLabel = a.squad ? ` — Squad ${a.squad}` : ''
  const objective = a.reasoning?.split('.')[0] || 'Assigned objective'

  // Backup leader for the same structure who takes over on rotation.
  const backupLeader = plan.assignments.find(
    x => x.squad === a.squad && x.role.toLowerCase().includes('leader') && x.is_backup,
  )
  const backupLine = backupLeader
    ? `\nBACKUP LEADER: ${backupLeader.player_name} takes over if you drop or rotate out.`
    : ''

  return `${header}

YOUR ROLE: Rally Leader${squadLabel}
YOUR TARGET: ${objective}${backupLine}

YOUR SQUAD (joiners who will follow your rally):
${joinerList}

HEROES TO USE:
${heroLines(a.hero_recommendation)}
All expedition skills from all 3 heroes apply when you lead — ensure Skills 1, 2, 3 are maxed.

TROOPS: ${formation}
Use TG troops first, then T10, T9, etc.

TIMING: ${timeWindow}
Wait for all joiners to fill before marching. Launch on schedule.

NOTES: ${a.reasoning || 'Lead your squad to the objective.'}`
}

function garrisonInstructions(
  a: BattlePlanAssignment,
  _plan: BattlePlan,
  header: string,
  timeWindow: string,
): string {
  const roleLabel = a.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const structure = a.squad
    ? a.squad.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'your assigned structure'
  const formation = a.formation_recommendation || '60% Infantry / 20% Cavalry / 20% Archer'

  return `${header}

YOUR ROLE: ${roleLabel}
OBJECTIVE: Hold ${structure}

HEROES FOR DEFENSE:
${heroLines(a.hero_recommendation)}
Prioritize heroes with defensive skills — HP, Defense, and damage reduction.

FORMATION: ${formation}
Bring your tankiest troops — HP and Defense matter most for garrison.
Higher tier troops survive longer under fire. Fill to your march capacity.

TIME WINDOW: ${timeWindow}

NOTES: ${a.reasoning || 'Hold your position. Do not leave the structure unmanned.'}`
}

function supportInstructions(
  a: BattlePlanAssignment,
  _plan: BattlePlan,
  header: string,
  timeWindow: string,
): string {
  const roleLabel = a.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return `${header}

YOUR ROLE: ${roleLabel}

WHAT TO DO:
Launch solo rallies or join weakening rallies against enemy players.
Target players attacking our structures to reduce their troop count.
Do NOT attack our alliance's assigned structures — leave those to designated squad leaders.

HEROES TO USE:
${heroLines(a.hero_recommendation)}

TROOPS: Your strongest available troops.

TIME WINDOW: ${timeWindow}

NOTES: ${a.reasoning || 'Provide flexible support where needed most.'}`
}

export function generateMemberInstructions(
  assignment: BattlePlanAssignment,
  plan: BattlePlan,
  eventName: string,
  eventStartUtc: string | null,
): string {
  const role = assignment.role.toLowerCase()
  const header = `YOUR BATTLE ASSIGNMENT — ${eventName} — ${fmtDate(eventStartUtc)}`
  const timeWindow =
    assignment.time_window_start && assignment.time_window_end
      ? `${fmtTime(assignment.time_window_start)} UTC to ${fmtTime(assignment.time_window_end)} UTC`
      : (assignment.time_window || 'Full event')

  if (role.includes('joiner')) return joinerInstructions(assignment, plan, header, timeWindow)
  if (role.includes('leader')) return leaderInstructions(assignment, plan, header, timeWindow)
  if (
    role.includes('garrison') ||
    role.includes('castle') ||
    role.includes('turret') ||
    role.includes('defender')
  )
    return garrisonInstructions(assignment, plan, header, timeWindow)
  return supportInstructions(assignment, plan, header, timeWindow)
}
