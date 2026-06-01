/**
 * fix-admin-profile.ts
 *
 * One-time script to:
 * 1. Find the system_admin user in user_profiles
 * 2. Find the TNT Central alliance
 * 3. Find the IdahoPotato member record
 * 4. Link them all together
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/fix-admin-profile.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔍 Looking up system_admin user…')
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id, display_name, role, alliance_id')
    .eq('role', 'system_admin')

  if (!admins || admins.length === 0) {
    console.error('❌ No system_admin user found in user_profiles')
    process.exit(1)
  }

  console.log(`Found ${admins.length} system_admin user(s):`)
  admins.forEach(a => console.log(`  - ${a.id} (${a.display_name}), alliance_id=${a.alliance_id}`))

  const adminUser = admins[0]

  // Find TNT Central alliance
  console.log('\n🔍 Looking up TNT Central alliance…')
  const { data: alliances } = await supabase
    .from('alliances')
    .select('id, name, tag')
    .ilike('name', '%central%')

  if (!alliances || alliances.length === 0) {
    console.log('No alliance with "central" in name found. Searching by tag "TNT"…')
    const { data: tntAlliances } = await supabase
      .from('alliances')
      .select('id, name, tag')
      .ilike('tag', '%TNT%')
    if (!tntAlliances || tntAlliances.length === 0) {
      console.error('❌ Could not find TNT Central alliance. Please check alliance name/tag.')
      // List all alliances
      const { data: all } = await supabase.from('alliances').select('id, name, tag')
      console.log('All alliances:', all)
      process.exit(1)
    }
    console.log('TNT alliances:', tntAlliances)
    alliances?.push(...tntAlliances)
  }

  console.log('Found alliances:', alliances)
  const tntAlliance = alliances[0]
  console.log(`\n✅ Using alliance: [${tntAlliance.tag}] ${tntAlliance.name} (${tntAlliance.id})`)

  // Find IdahoPotato member record
  console.log('\n🔍 Looking up IdahoPotato member…')
  const { data: members } = await supabase
    .from('members')
    .select('id, player_name, alliance_id, linked_user_id')
    .ilike('player_name', '%Idaho%')

  console.log('Found members:', members)

  if (!members || members.length === 0) {
    console.log('❌ No member with "Idaho" in name found.')
    console.log('Listing all members in the alliance:')
    const { data: allianceMembers } = await supabase
      .from('members')
      .select('id, player_name, linked_user_id')
      .eq('alliance_id', tntAlliance.id)
    console.log(allianceMembers)
    process.exit(1)
  }

  const idahoMember = members[0]
  console.log(`✅ Found member: ${idahoMember.player_name} (${idahoMember.id})`)

  // Update system_admin user_profile.alliance_id
  console.log(`\n⚙️  Setting system_admin alliance_id to ${tntAlliance.id}…`)
  const { error: profileErr } = await supabase
    .from('user_profiles')
    .update({ alliance_id: tntAlliance.id })
    .eq('id', adminUser.id)

  if (profileErr) {
    console.error('❌ Failed to update user_profiles:', profileErr.message)
    process.exit(1)
  }
  console.log('✅ user_profiles.alliance_id updated')

  // Link IdahoPotato member to admin user
  console.log(`\n⚙️  Linking IdahoPotato (${idahoMember.id}) to admin user (${adminUser.id})…`)
  const { error: memberErr } = await supabase
    .from('members')
    .update({ linked_user_id: adminUser.id, alliance_id: tntAlliance.id })
    .eq('id', idahoMember.id)

  if (memberErr) {
    console.error('❌ Failed to update member:', memberErr.message)
    process.exit(1)
  }
  console.log('✅ member.linked_user_id updated')

  console.log('\n🎉 Done! Admin profile is now linked to IdahoPotato in [TNT] Central.')
  console.log('   - System admin will see alliance chat button in sidebar')
  console.log('   - System admin will appear in the member directory')
  console.log('   - System admin can participate in alliance chat')
}

main().catch(console.error)
