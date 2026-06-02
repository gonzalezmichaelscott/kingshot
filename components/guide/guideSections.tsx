// @ts-nocheck
// Shared Leader Guide content. Imported by both the in-app LeaderGuide
// (authenticated) and the public /welcome landing page. Contains no client
// hooks so it can be rendered from a server component.
import { Info } from 'lucide-react'

export interface Section {
  id: string
  title: string
  body: React.ReactNode
}

// Amber highlight box for important notes.
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 my-3 text-sm text-amber-100">
      <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-300 my-2">{children}</ul>
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-100 mt-4 mb-1">{children}</h3>
}

export const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    body: (
      <>
        <p className="text-sm text-slate-300">KS Command is a planning hub for Kingshot alliance leaders. It replaces scattered in-game chat with structured member data, event attendance, and AI-assisted battle plans.</p>
        <H3>Setting up your Kingdom and Alliance</H3>
        <UL>
          <li>Create your Kingdom (server number) from the Kingdoms page.</li>
          <li>Create your Alliance under that kingdom with its tag and name.</li>
          <li>You become R5 (alliance leader) of the alliance you create.</li>
        </UL>
        <H3>Inviting your first members</H3>
        <UL>
          <li>Add members manually or via CSV import (see section 2).</li>
          <li>Send each member their self-service link so they can claim their profile.</li>
        </UL>
        <H3>Understanding roles (R1–R5)</H3>
        <UL>
          <li><span className="text-amber-400 font-medium">R5</span> — alliance leader. Full control: members, events, roles up to R5, KVK toggle.</li>
          <li><span className="text-amber-400 font-medium">R4</span> — officer. Manage members, events, battle plans; can promote up to R4.</li>
          <li><span className="text-amber-400 font-medium">R1–R3</span> — members. See their own profile, assignments, and events; no backend access.</li>
          <li><span className="text-amber-400 font-medium">System Admin</span> — platform-wide access and fallback approver.</li>
        </UL>
        <Note>All times in the app are shown in 24-hour UTC because Kingshot runs on UTC (GMT). “14:30 UTC” means 14:30, not 2:30 PM.</Note>
      </>
    ),
  },
  {
    id: 'adding-members',
    title: '2. Adding Members',
    body: (
      <>
        <H3>Bulk import with CSV</H3>
        <UL>
          <li>Open Members → Import. Download or match the template columns (game_id is required — player names are auto-fetched).</li>
          <li>Paste or upload your roster and confirm. Duplicates are skipped by game ID.</li>
        </UL>
        <H3>Adding members one at a time</H3>
        <UL>
          <li>Members → Add Member. Enter the game ID; the player name is pulled from the game API.</li>
        </UL>
        <H3>Self-service links & claiming</H3>
        <UL>
          <li>Each member has a unique self-service link at the top of their profile page — copy the full URL and send it in-game.</li>
          <li>The player opens the link, signs in, and claims the profile. You approve the claim from the member profile’s Profile Status card.</li>
        </UL>
        <H3>Approving join requests</H3>
        <UL>
          <li>Join and rank requests appear on the Approvals page (sidebar badge shows the count).</li>
          <li>R5 approves R4/R5 requests; R4 and R5 approve R1–R3 requests.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'member-data',
    title: '3. Member Data',
    body: (
      <>
        <p className="text-sm text-slate-300">Accurate member data is what makes battle plans good. The planner scores every member from these inputs.</p>
        <H3>What stats to collect</H3>
        <UL>
          <li><span className="font-medium">Power</span> — overall account strength.</li>
          <li><span className="font-medium">March Size</span> — troops per march (must be ≥ rally capacity to lead a full rally).</li>
          <li><span className="font-medium">Rally Capacity</span> — total troops a rally can hold.</li>
          <li><span className="font-medium">Combat Stats</span> — per-troop-type Attack, Defense, Health, Lethality %.</li>
        </UL>
        <H3>Getting combat stats (battle report method)</H3>
        <UL>
          <li>Temporarily leave the alliance, garrison a mine, and get attacked.</li>
          <li>The battle report shows your true ATK/DEF/HP/Lethality — enter those percentages.</li>
        </UL>
        <H3>Hero data</H3>
        <UL>
          <li>Enter each member’s key heroes, star level, and widget status.</li>
          <li>Expedition skills matter most — they drive the biggest share of rally damage and decide good rally leaders vs joiners.</li>
        </UL>
        <H3>Troop tier data</H3>
        <UL>
          <li>Record troop counts by tier (T1–T10, TG1–TG8). Higher tiers survive longer and hit harder.</li>
          <li>Joiners with high-tier troops contribute far more than joiners with low-tier troops, even at lower counts.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'events',
    title: '4. Events',
    body: (
      <>
        <H3>Swordland Showdown</H3>
        <UL>
          <li>Create the event and enter both Legion 1 and Legion 2 battle times (UTC, 24-hour).</li>
          <li>Members pick which Legion to join from their self-service link.</li>
        </UL>
        <H3>KVK Castle Battle</H3>
        <UL>
          <li>Multi-alliance castle fight, 12:00–17:00 UTC. Coordinate through KVK Command.</li>
        </UL>
        <H3>Castle Battle (single alliance)</H3>
        <UL>
          <li>Alliance-vs-alliance version within your server. Hold the King Castle 2.5 consecutive hours to win instantly.</li>
          <li>Castle is top priority — the planner staffs 2 castle teams first, then turrets North → East → South → West.</li>
        </UL>
        <H3>Tri Alliance Clash & Custom events</H3>
        <UL>
          <li>Tri Alliance Clash assigns by phase (Seize, Garrison, Temple).</li>
          <li>Custom events let you write your own plan and push it straight to member profiles.</li>
        </UL>
        <H3>Attendance</H3>
        <UL>
          <li>Members submit “will attend” + available UTC hours from their self-service link.</li>
          <li>For players who don’t use the app, R4/R5 can set attendance manually on the event page.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'battle-planning',
    title: '5. Battle Planning',
    body: (
      <>
        <H3>Generating a plan</H3>
        <UL>
          <li>On an event page, click <span className="font-medium">Generate Battle Plan</span>. The AI uses member scores, hero synergy, and availability.</li>
        </UL>
        <H3>Rally leaders vs joiners</H3>
        <UL>
          <li>Rally leaders bring all 3 heroes’ expedition skills and need march size ≥ rally capacity.</li>
          <li>Joiners contribute only their lead hero’s first expedition skill — stack complementary effect_ops.</li>
        </UL>
        <H3>Reading the output</H3>
        <UL>
          <li>Each assignment includes role, squad, formation, hero lineup, and reasoning.</li>
          <li>Plans are pushed to member profiles with plain-language instructions and a Copy button.</li>
        </UL>
        <Note>Manual overrides: you can edit assignments and re-generate. Re-generating replaces the current plan, so finalize attendance first.</Note>
        <H3>KVK cooperation</H3>
        <UL>
          <li>Enable KVK mode to coordinate cross-alliance. Plan A keeps joiners in-alliance; Plan B allows willing-to-move transfers.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'kvk-coordination',
    title: '6. KVK Coordination',
    body: (
      <>
        <UL>
          <li>Enable KVK mode from the Alliance Hub (R5).</li>
          <li>The KVK hub combines the member pool across allied alliances and adds a cross-alliance command chat.</li>
          <li><span className="font-medium">Plan A</span> = alliance-only joiners. <span className="font-medium">Plan B</span> = include members flagged “willing to move” for stronger rallies.</li>
          <li>Add voice channel links so squads can jump straight into comms.</li>
          <li>Use the Rally Timer to land rallies together during the castle fight.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'communication',
    title: '7. Communication Tools',
    body: (
      <>
        <UL>
          <li><span className="font-medium">Alliance chat</span> — slide-out panel available to every role with an alliance.</li>
          <li><span className="font-medium">@ mentions</span> notify the mentioned member via the notification bell.</li>
          <li><span className="font-medium">Message board</span> for persistent announcements.</li>
          <li><span className="font-medium">Message templates</span> save reusable messages (KVK attendance, stats reminders, Swordland) — copy with one click.</li>
          <li><span className="font-medium">Translation</span> helps multilingual alliances read each other’s messages.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'rally-timer',
    title: '8. Rally Timer',
    body: (
      <>
        <UL>
          <li>Open the Rally Timer in a new tab and create a session for your squad.</li>
          <li><span className="font-medium">Simultaneous</span> landing syncs every rally to land at once; <span className="font-medium">staggered</span> lands them in waves with a set gap.</li>
          <li>Share the session link so each rally leader sees the same synchronized countdown.</li>
          <li>The 3-2-1 countdown (on by default) and launch audio tell each leader exactly when to send.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'tips',
    title: '9. Tips for Success',
    body: (
      <>
        <UL>
          <li>Collect combat stats and hero data for your top 30 players before any major event.</li>
          <li>Refresh stats every couple of weeks, and always before KVK.</li>
          <li>During KVK, flag movers with “willing to move” so Plan B can build the strongest rallies.</li>
          <li>Keep attendance current — sync it right before generating the final plan.</li>
        </UL>
        <Note>Garbage in, garbage out: the battle plan is only as good as the member data behind it. Data first, plans second.</Note>
      </>
    ),
  },
]
