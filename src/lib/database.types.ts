/**
 * Database type definitions for the Supabase schema.
 *
 * Hand-maintained to match the SQL migrations in `supabase/migrations`.
 * Keep in sync when migrations change.
 */
export type RoomStatus = 'waiting' | 'ready' | 'playing' | 'finished';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar: string;
          badge: string | null;
          online_status: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar?: string;
          badge?: string | null;
          online_status?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar?: string;
          badge?: string | null;
          online_status?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          host_id: string;
          status: RoomStatus;
          selected_game: string | null;
          rules: Record<string, unknown>;
          max_players: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          host_id: string;
          status?: RoomStatus;
          selected_game?: string | null;
          rules?: Record<string, unknown>;
          max_players?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string;
          status?: RoomStatus;
          selected_game?: string | null;
          rules?: Record<string, unknown>;
          max_players?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_players: {
        Row: {
          id: string;
          room_id: string;
          player_id: string;
          is_ready: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          is_ready?: boolean;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          is_ready?: boolean;
          joined_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          room_id: string;
          game_key: string;
          started_at: string;
          ended_at: string | null;
          winner_id: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          game_key: string;
          started_at?: string;
          ended_at?: string | null;
          winner_id?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          game_key?: string;
          started_at?: string;
          ended_at?: string | null;
          winner_id?: string | null;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          id: string;
          match_id: string;
          player_id: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          player_id: string;
          score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          player_id?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      server_now: {
        Args: Record<string, never>;
        Returns: number;
      };
      cleanup_stale_rooms: {
        Args: { p_max_age_hours?: number };
        Returns: number;
      };
      is_room_member: {
        Args: { p_room_id: string };
        Returns: boolean;
      };
      is_room_host: {
        Args: { p_room_id: string };
        Returns: boolean;
      };
      is_match_participant: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      room_status: RoomStatus;
    };
  };
};
