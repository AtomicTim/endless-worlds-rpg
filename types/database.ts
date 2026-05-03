// Supabase database types — mirrors 001_initial_schema.sql exactly

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_seed: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_seed?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_seed?: string | null;
          created_at?: string;
        };
      };

      game_sessions: {
        Row: {
          id: string;
          user_id: string;
          character_name: string;
          genre: string;
          master_state: Json;
          last_played: string | null;
          time_played_seconds: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          character_name: string;
          genre: string;
          master_state?: Json;
          last_played?: string | null;
          time_played_seconds?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          character_name?: string;
          genre?: string;
          master_state?: Json;
          last_played?: string | null;
          time_played_seconds?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      characters: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          name: string;
          genre: string;
          health: number;
          max_health: number;
          strength: number;
          agility: number;
          charisma: number;
          intelligence: number;
          perception: number;
          level: number;
          xp: number;
          currency: number;
          background: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          name: string;
          genre: string;
          health?: number;
          max_health?: number;
          strength?: number;
          agility?: number;
          charisma?: number;
          intelligence?: number;
          perception?: number;
          level?: number;
          xp?: number;
          currency?: number;
          background?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          name?: string;
          genre?: string;
          health?: number;
          max_health?: number;
          strength?: number;
          agility?: number;
          charisma?: number;
          intelligence?: number;
          perception?: number;
          level?: number;
          xp?: number;
          currency?: number;
          background?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      world_states: {
        Row: {
          id: string;
          session_id: string;
          current_location_id: string;
          visited_locations: string[];
          flags: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          current_location_id?: string;
          visited_locations?: string[];
          flags?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          current_location_id?: string;
          visited_locations?: string[];
          flags?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      log_books: {
        Row: {
          id: string;
          session_id: string;
          entries: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          entries?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          entries?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      npcs: {
        Row: {
          id: string;
          session_id: string;
          npc_key: string;
          name: string;
          role: string | null;
          relationship_status: string;
          trust_score: number;
          memory_snippets: Json;
          faction_id: string | null;
          last_interaction: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          npc_key: string;
          name: string;
          role?: string | null;
          relationship_status?: string;
          trust_score?: number;
          memory_snippets?: Json;
          faction_id?: string | null;
          last_interaction?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          npc_key?: string;
          name?: string;
          role?: string | null;
          relationship_status?: string;
          trust_score?: number;
          memory_snippets?: Json;
          faction_id?: string | null;
          last_interaction?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          tier: string;
          status: string;
          current_period_end: string | null;
          daily_actions_used: number;
          daily_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string;
          status?: string;
          current_period_end?: string | null;
          daily_actions_used?: number;
          daily_reset_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string;
          status?: string;
          current_period_end?: string | null;
          daily_actions_used?: number;
          daily_reset_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      community_templates: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          description: string | null;
          genre: string;
          master_state_template: Json;
          rating_avg: number;
          play_count: number;
          tags: string[];
          is_featured: boolean;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          description?: string | null;
          genre: string;
          master_state_template?: Json;
          rating_avg?: number;
          play_count?: number;
          tags?: string[];
          is_featured?: boolean;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          description?: string | null;
          genre?: string;
          master_state_template?: Json;
          rating_avg?: number;
          play_count?: number;
          tags?: string[];
          is_featured?: boolean;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          font_size: string;
          font_choice: string;
          ascii_art_enabled: boolean;
          master_volume: number;
          ambient_volume: number;
          difficulty: string;
          high_contrast: boolean;
          reduced_motion: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          font_size?: string;
          font_choice?: string;
          ascii_art_enabled?: boolean;
          master_volume?: number;
          ambient_volume?: number;
          difficulty?: string;
          high_contrast?: boolean;
          reduced_motion?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          font_size?: string;
          font_choice?: string;
          ascii_art_enabled?: boolean;
          master_volume?: number;
          ambient_volume?: number;
          difficulty?: string;
          high_contrast?: boolean;
          reduced_motion?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;

    Enums: {
      subscription_tier: "free" | "adventurer" | "legend";
    };
  };
}

// Convenience row-type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type GameSession = Database["public"]["Tables"]["game_sessions"]["Row"];
export type Character = Database["public"]["Tables"]["characters"]["Row"];
export type WorldState = Database["public"]["Tables"]["world_states"]["Row"];
export type LogBook = Database["public"]["Tables"]["log_books"]["Row"];
export type NPC = Database["public"]["Tables"]["npcs"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type CommunityTemplate = Database["public"]["Tables"]["community_templates"]["Row"];
export type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];
