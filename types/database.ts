// Supabase database types for Endless Worlds RPG

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          subscription_tier: "free" | "adventurer" | "legend";
          ai_actions_today: number;
          ai_actions_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      game_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          genre: string;
          master_state: unknown; // JSON - typed as MasterState at runtime
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["game_sessions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["game_sessions"]["Insert"]>;
      };
      action_log: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          player_input: string;
          parsed_intent: unknown; // JSON
          action_result: unknown; // JSON
          narrator_response: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["action_log"]["Row"], "id" | "created_at">;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_tier: "free" | "adventurer" | "legend";
    };
  };
}
