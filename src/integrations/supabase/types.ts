export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      enrichment_cache: {
        Row: {
          cached_at: string
          domain: string
          payload: Json
        }
        Insert: {
          cached_at?: string
          domain: string
          payload: Json
        }
        Update: {
          cached_at?: string
          domain?: string
          payload?: Json
        }
        Relationships: []
      }
      iso_wholesale_prices: {
        Row: {
          error: string | null
          fetched_at: string
          hub: string
          interval_start: string | null
          iso: string
          iso_name: string
          load_at: string | null
          load_mw: number | null
          market: string
          price_mwh: number | null
          rt_price_mwh: number | null
          spread_pct: number | null
        }
        Insert: {
          error?: string | null
          fetched_at?: string
          hub?: string
          interval_start?: string | null
          iso: string
          iso_name?: string
          load_at?: string | null
          load_mw?: number | null
          market?: string
          price_mwh?: number | null
          rt_price_mwh?: number | null
          spread_pct?: number | null
        }
        Update: {
          error?: string | null
          fetched_at?: string
          hub?: string
          interval_start?: string | null
          iso?: string
          iso_name?: string
          load_at?: string | null
          load_mw?: number | null
          market?: string
          price_mwh?: number | null
          rt_price_mwh?: number | null
          spread_pct?: number | null
        }
        Relationships: []
      }
      pipeline_records: {
        Row: {
          business_name: string
          campaign_id: string
          campaign_name: string
          contact_name: string
          created_at: string
          date_added: string
          deregulated: string
          domain: string | null
          email: string
          energy_priority: string
          industry: string
          industry_label: string
          last_synced: string | null
          lead_id: string
          status: string
          tier: string
          title: string
          updated_at: string
        }
        Insert: {
          business_name?: string
          campaign_id?: string
          campaign_name?: string
          contact_name?: string
          created_at?: string
          date_added?: string
          deregulated?: string
          domain?: string | null
          email?: string
          energy_priority?: string
          industry?: string
          industry_label?: string
          last_synced?: string | null
          lead_id: string
          status?: string
          tier?: string
          title?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          campaign_id?: string
          campaign_name?: string
          contact_name?: string
          created_at?: string
          date_added?: string
          deregulated?: string
          domain?: string | null
          email?: string
          energy_priority?: string
          industry?: string
          industry_label?: string
          last_synced?: string | null
          lead_id?: string
          status?: string
          tier?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      target_lists: {
        Row: {
          created_at: string
          generated_at: string
          items: Json
          next_refresh_at: string
          period_id: string
        }
        Insert: {
          created_at?: string
          generated_at: string
          items: Json
          next_refresh_at: string
          period_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          items?: Json
          next_refresh_at?: string
          period_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
