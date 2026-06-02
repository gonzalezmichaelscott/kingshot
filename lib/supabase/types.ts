export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      kingdoms: {
        Row: {
          id: string
          name: string
          server_number: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          server_number?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          server_number?: number | null
          created_at?: string
        }
      }
      alliances: {
        Row: {
          id: string
          kingdom_id: string | null
          name: string
          tag: string
          kvk_enabled: boolean
          discord_server_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          kingdom_id?: string | null
          name: string
          tag: string
          kvk_enabled?: boolean
          discord_server_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          kingdom_id?: string | null
          name?: string
          tag?: string
          kvk_enabled?: boolean
          discord_server_id?: string | null
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          alliance_id: string | null
          role: 'system_admin' | 'kingdom_leader' | 'r5' | 'r4' | 'member' | null
          display_name: string | null
          preferred_language: string | null
          created_at: string
        }
        Insert: {
          id: string
          alliance_id?: string | null
          role?: 'system_admin' | 'kingdom_leader' | 'r5' | 'r4' | 'member' | null
          display_name?: string | null
          preferred_language?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          alliance_id?: string | null
          role?: 'system_admin' | 'kingdom_leader' | 'r5' | 'r4' | 'member' | null
          display_name?: string | null
          preferred_language?: string | null
          created_at?: string
        }
      }
      members: {
        Row: {
          id: string
          alliance_id: string | null
          player_name: string
          game_id: string | null
          power: number
          troop_count: number
          march_size: number
          rally_capacity: number
          timezone: string
          access_token: string
          linked_user_id: string | null
          participation_history: Json
          troop_data: Json | null
          notes: string | null
          preferred_language: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          alliance_id?: string | null
          player_name: string
          game_id?: string | null
          power?: number
          troop_count?: number
          march_size?: number
          rally_capacity?: number
          timezone?: string
          access_token?: string
          linked_user_id?: string | null
          participation_history?: Json
          troop_data?: Json | null
          notes?: string | null
          preferred_language?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          alliance_id?: string | null
          player_name?: string
          game_id?: string | null
          power?: number
          troop_count?: number
          march_size?: number
          rally_capacity?: number
          timezone?: string
          access_token?: string
          linked_user_id?: string | null
          participation_history?: Json
          troop_data?: Json | null
          notes?: string | null
          preferred_language?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      member_combat_stats: {
        Row: {
          id: string
          member_id: string | null
          infantry_attack: number
          infantry_defense: number
          infantry_health: number
          infantry_lethality: number
          cavalry_attack: number
          cavalry_defense: number
          cavalry_health: number
          cavalry_lethality: number
          archer_attack: number
          archer_defense: number
          archer_health: number
          archer_lethality: number
          troop_type_primary: 'infantry' | 'cavalry' | 'archer' | 'mixed' | null
          source: 'ocr' | 'manual' | 'ocr_verified'
          screenshot_url: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          member_id?: string | null
          infantry_attack?: number
          infantry_defense?: number
          infantry_health?: number
          infantry_lethality?: number
          cavalry_attack?: number
          cavalry_defense?: number
          cavalry_health?: number
          cavalry_lethality?: number
          archer_attack?: number
          archer_defense?: number
          archer_health?: number
          archer_lethality?: number
          troop_type_primary?: 'infantry' | 'cavalry' | 'archer' | 'mixed' | null
          source?: 'ocr' | 'manual' | 'ocr_verified'
          screenshot_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string | null
          infantry_attack?: number
          infantry_defense?: number
          infantry_health?: number
          infantry_lethality?: number
          cavalry_attack?: number
          cavalry_defense?: number
          cavalry_health?: number
          cavalry_lethality?: number
          archer_attack?: number
          archer_defense?: number
          archer_health?: number
          archer_lethality?: number
          troop_type_primary?: 'infantry' | 'cavalry' | 'archer' | 'mixed' | null
          source?: 'ocr' | 'manual' | 'ocr_verified'
          screenshot_url?: string | null
          updated_at?: string
        }
      }
      heroes: {
        Row: {
          id: string
          name: string
          generation: number
          troop_type: 'infantry' | 'cavalry' | 'archer' | 'all' | null
          role: 'rally_leader' | 'joiner' | 'support' | 'garrison' | 'flex' | null
          rarity: 'common' | 'rare' | 'epic' | 'legendary' | null
          expedition_skills: Json
          base_stats: Json
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          generation: number
          troop_type?: 'infantry' | 'cavalry' | 'archer' | 'all' | null
          role?: 'rally_leader' | 'joiner' | 'support' | 'garrison' | 'flex' | null
          rarity?: 'common' | 'rare' | 'epic' | 'legendary' | null
          expedition_skills?: Json
          base_stats?: Json
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          generation?: number
          troop_type?: 'infantry' | 'cavalry' | 'archer' | 'all' | null
          role?: 'rally_leader' | 'joiner' | 'support' | 'garrison' | 'flex' | null
          rarity?: 'common' | 'rare' | 'epic' | 'legendary' | null
          expedition_skills?: Json
          base_stats?: Json
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      member_heroes: {
        Row: {
          id: string
          member_id: string | null
          hero_id: string | null
          hero_level: number
          star_level: number
          widget_level: number
          expedition_skill_levels: Json
          is_primary: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          member_id?: string | null
          hero_id?: string | null
          hero_level?: number
          star_level?: number
          widget_level?: number
          expedition_skill_levels?: Json
          is_primary?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          member_id?: string | null
          hero_id?: string | null
          hero_level?: number
          star_level?: number
          widget_level?: number
          expedition_skill_levels?: Json
          is_primary?: boolean
          updated_at?: string
        }
      }
      event_types: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          schedule_description: string | null
          duration_minutes: number | null
          rules: Json
          scoring_weights: Json
          assignment_logic: Json
          objectives: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          schedule_description?: string | null
          duration_minutes?: number | null
          rules?: Json
          scoring_weights?: Json
          assignment_logic?: Json
          objectives?: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          schedule_description?: string | null
          duration_minutes?: number | null
          rules?: Json
          scoring_weights?: Json
          assignment_logic?: Json
          objectives?: Json
          is_active?: boolean
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          alliance_id: string | null
          event_type_id: string | null
          name: string | null
          battle_start_utc: string | null
          battle_end_utc: string | null
          legion1_start_utc: string | null
          legion2_start_utc: string | null
          status: 'planning' | 'registration' | 'active' | 'completed'
          battle_plan: Json
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          alliance_id?: string | null
          event_type_id?: string | null
          name?: string | null
          battle_start_utc?: string | null
          battle_end_utc?: string | null
          legion1_start_utc?: string | null
          legion2_start_utc?: string | null
          status?: 'planning' | 'registration' | 'active' | 'completed'
          battle_plan?: Json
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          alliance_id?: string | null
          event_type_id?: string | null
          name?: string | null
          battle_start_utc?: string | null
          battle_end_utc?: string | null
          legion1_start_utc?: string | null
          legion2_start_utc?: string | null
          status?: 'planning' | 'registration' | 'active' | 'completed'
          battle_plan?: Json
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          type: string
          title: string
          message: string | null
          link: string | null
          is_read: boolean
          related_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: string
          title: string
          message?: string | null
          link?: string | null
          is_read?: boolean
          related_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: string
          title?: string
          message?: string | null
          link?: string | null
          is_read?: boolean
          related_id?: string | null
          created_at?: string
        }
      }
      event_availability: {
        Row: {
          id: string
          event_id: string | null
          member_id: string | null
          will_attend: boolean
          available_from_utc: string | null
          available_to_utc: string | null
          squad_preference: string | null
          notes: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          member_id?: string | null
          will_attend?: boolean
          available_from_utc?: string | null
          available_to_utc?: string | null
          squad_preference?: string | null
          notes?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          member_id?: string | null
          will_attend?: boolean
          available_from_utc?: string | null
          available_to_utc?: string | null
          squad_preference?: string | null
          notes?: string | null
          submitted_at?: string
        }
      }
      event_assignments: {
        Row: {
          id: string
          event_id: string | null
          member_id: string | null
          role: string
          squad: string | null
          is_primary: boolean
          is_backup: boolean
          time_window_start: string | null
          time_window_end: string | null
          reasoning: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          member_id?: string | null
          role: string
          squad?: string | null
          is_primary?: boolean
          is_backup?: boolean
          time_window_start?: string | null
          time_window_end?: string | null
          reasoning?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          member_id?: string | null
          role?: string
          squad?: string | null
          is_primary?: boolean
          is_backup?: boolean
          time_window_start?: string | null
          time_window_end?: string | null
          reasoning?: string | null
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          alliance_id: string | null
          author_id: string | null
          title: string | null
          content: string
          is_pinned: boolean
          attachments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          alliance_id?: string | null
          author_id?: string | null
          title?: string | null
          content: string
          is_pinned?: boolean
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          alliance_id?: string | null
          author_id?: string | null
          title?: string | null
          content?: string
          is_pinned?: boolean
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
      }
      post_replies: {
        Row: {
          id: string
          post_id: string | null
          author_id: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id?: string | null
          author_id?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string | null
          author_id?: string | null
          content?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          alliance_id: string | null
          author_id: string | null
          content: string
          translated_content: Json
          attachments: Json
          created_at: string
        }
        Insert: {
          id?: string
          alliance_id?: string | null
          author_id?: string | null
          content: string
          translated_content?: Json
          attachments?: Json
          created_at?: string
        }
        Update: {
          id?: string
          alliance_id?: string | null
          author_id?: string | null
          content?: string
          translated_content?: Json
          attachments?: Json
          created_at?: string
        }
      }
      chat_mentions: {
        Row: {
          id: string
          message_id: string | null
          mentioned_member_id: string | null
          alliance_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          message_id?: string | null
          mentioned_member_id?: string | null
          alliance_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string | null
          mentioned_member_id?: string | null
          alliance_id?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      kvk_voice_channels: {
        Row: {
          id: string
          kingdom_id: string | null
          channel_name: string
          discord_invite_url: string | null
          minimum_role: string
          is_active: boolean
        }
        Insert: {
          id?: string
          kingdom_id?: string | null
          channel_name: string
          discord_invite_url?: string | null
          minimum_role?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          kingdom_id?: string | null
          channel_name?: string
          discord_invite_url?: string | null
          minimum_role?: string
          is_active?: boolean
        }
      }
      member_scores: {
        Row: {
          id: string
          member_id: string | null
          overall_score: number
          rally_leader_score: number
          joiner_score: number
          castle_score: number
          turret_score: number
          defender_score: number
          support_score: number
          score_version: number
          calculated_at: string
        }
        Insert: {
          id?: string
          member_id?: string | null
          overall_score?: number
          rally_leader_score?: number
          joiner_score?: number
          castle_score?: number
          turret_score?: number
          defender_score?: number
          support_score?: number
          score_version?: number
          calculated_at?: string
        }
        Update: {
          id?: string
          member_id?: string | null
          overall_score?: number
          rally_leader_score?: number
          joiner_score?: number
          castle_score?: number
          turret_score?: number
          defender_score?: number
          support_score?: number
          score_version?: number
          calculated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_role: {
        Args: Record<string, never>
        Returns: string
      }
      get_user_alliance_id: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}

// Convenience types
export type Kingdom = Database['public']['Tables']['kingdoms']['Row']
export type Alliance = Database['public']['Tables']['alliances']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Member = Database['public']['Tables']['members']['Row']
export type MemberCombatStats = Database['public']['Tables']['member_combat_stats']['Row']
export type Hero = Database['public']['Tables']['heroes']['Row']
export type MemberHero = Database['public']['Tables']['member_heroes']['Row']
export type EventType = Database['public']['Tables']['event_types']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type EventAvailability = Database['public']['Tables']['event_availability']['Row']
export type EventAssignment = Database['public']['Tables']['event_assignments']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type PostReply = Database['public']['Tables']['post_replies']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type KvkVoiceChannel = Database['public']['Tables']['kvk_voice_channels']['Row']
export type MemberScore = Database['public']['Tables']['member_scores']['Row']
