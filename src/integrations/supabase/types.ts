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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      autocontrols: {
        Row: {
          article: string
          collaborateur: string
          control_date: string
          created_at: string
          dlc: string | null
          extra_data: Json | null
          fiche_type: string
          id: string
          lot_number: string | null
          notes: string | null
          quantity: number | null
          updated_at: string
          visa_manager: string | null
        }
        Insert: {
          article: string
          collaborateur: string
          control_date: string
          created_at?: string
          dlc?: string | null
          extra_data?: Json | null
          fiche_type: string
          id?: string
          lot_number?: string | null
          notes?: string | null
          quantity?: number | null
          updated_at?: string
          visa_manager?: string | null
        }
        Update: {
          article?: string
          collaborateur?: string
          control_date?: string
          created_at?: string
          dlc?: string | null
          extra_data?: Json | null
          fiche_type?: string
          id?: string
          lot_number?: string | null
          notes?: string | null
          quantity?: number | null
          updated_at?: string
          visa_manager?: string | null
        }
        Relationships: []
      }
      initial_stocks: {
        Row: {
          carton_enabled: boolean
          created_at: string
          id: string
          paquet_enabled: boolean
          pieces_per_carton: number
          pieces_per_paquet: number
          product_id: string
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          carton_enabled?: boolean
          created_at?: string
          id?: string
          paquet_enabled?: boolean
          pieces_per_carton?: number
          pieces_per_paquet?: number
          product_id: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          carton_enabled?: boolean
          created_at?: string
          id?: string
          paquet_enabled?: boolean
          pieces_per_carton?: number
          pieces_per_paquet?: number
          product_id?: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      lot_entries: {
        Row: {
          created_at: string
          entry_date: string
          expiry_date: string
          id: string
          lot_number: string
          product_id: string
          quantity: number
          remaining_quantity: number
        }
        Insert: {
          created_at?: string
          entry_date: string
          expiry_date: string
          id?: string
          lot_number: string
          product_id: string
          quantity: number
          remaining_quantity?: number
        }
        Update: {
          created_at?: string
          entry_date?: string
          expiry_date?: string
          id?: string
          lot_number?: string
          product_id?: string
          quantity?: number
          remaining_quantity?: number
        }
        Relationships: []
      }
      requisitions: {
        Row: {
          created_at: string
          date: string
          id: string
          performed_by: string | null
          product_id: string
          product_name: string
          quantity: number
          type: string
          unit_used: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          performed_by?: string | null
          product_id: string
          product_name: string
          quantity: number
          type: string
          unit_used?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          performed_by?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          type?: string
          unit_used?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          category: string
          created_at: string
          date: string
          destination: string | null
          id: string
          performed_by: string | null
          product_id: string
          product_name: string
          quantity: number
          type: string
          unit_used: string
        }
        Insert: {
          category: string
          created_at?: string
          date: string
          destination?: string | null
          id?: string
          performed_by?: string | null
          product_id: string
          product_name: string
          quantity: number
          type: string
          unit_used?: string
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          destination?: string | null
          id?: string
          performed_by?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          type?: string
          unit_used?: string
        }
        Relationships: []
      }
      weekly_tracking: {
        Row: {
          article: string | null
          couleur: string | null
          created_at: string
          day_of_week: string
          entrees: number | null
          fiche_type: string
          id: string
          lot_number: string | null
          odeur: string | null
          quantity: number | null
          row_index: number
          sorties: number | null
          stock_initial: number | null
          texture: string | null
          updated_at: string
          visa_manager: string | null
          visa_operateur: string | null
          week_start: string
        }
        Insert: {
          article?: string | null
          couleur?: string | null
          created_at?: string
          day_of_week: string
          entrees?: number | null
          fiche_type: string
          id?: string
          lot_number?: string | null
          odeur?: string | null
          quantity?: number | null
          row_index?: number
          sorties?: number | null
          stock_initial?: number | null
          texture?: string | null
          updated_at?: string
          visa_manager?: string | null
          visa_operateur?: string | null
          week_start: string
        }
        Update: {
          article?: string | null
          couleur?: string | null
          created_at?: string
          day_of_week?: string
          entrees?: number | null
          fiche_type?: string
          id?: string
          lot_number?: string | null
          odeur?: string | null
          quantity?: number | null
          row_index?: number
          sorties?: number | null
          stock_initial?: number | null
          texture?: string | null
          updated_at?: string
          visa_manager?: string | null
          visa_operateur?: string | null
          week_start?: string
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
