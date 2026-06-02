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
      finished_products: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          id: string
          name: string
          notes: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      fridge_temperatures: {
        Row: {
          action_corrective: string | null
          commentaire: string | null
          conformite: string | null
          control_date: string
          created_at: string
          equipment_code: string
          equipment_name: string
          equipment_type: string
          id: string
          performed_by: string
          slot: string
          temperature_bas: number | null
          temperature_haut: number | null
          updated_at: string
          visa_manager: string | null
          zone: string
        }
        Insert: {
          action_corrective?: string | null
          commentaire?: string | null
          conformite?: string | null
          control_date: string
          created_at?: string
          equipment_code: string
          equipment_name: string
          equipment_type: string
          id?: string
          performed_by: string
          slot: string
          temperature_bas?: number | null
          temperature_haut?: number | null
          updated_at?: string
          visa_manager?: string | null
          zone: string
        }
        Update: {
          action_corrective?: string | null
          commentaire?: string | null
          conformite?: string | null
          control_date?: string
          created_at?: string
          equipment_code?: string
          equipment_name?: string
          equipment_type?: string
          id?: string
          performed_by?: string
          slot?: string
          temperature_bas?: number | null
          temperature_haut?: number | null
          updated_at?: string
          visa_manager?: string | null
          zone?: string
        }
        Relationships: []
      }
      glace_grammage: {
        Row: {
          article: string
          created_at: string
          grammage_grams: number
          id: string
          updated_at: string
        }
        Insert: {
          article: string
          created_at?: string
          grammage_grams?: number
          id?: string
          updated_at?: string
        }
        Update: {
          article?: string
          created_at?: string
          grammage_grams?: number
          id?: string
          updated_at?: string
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
      production_entries: {
        Row: {
          created_at: string
          date: string
          finished_product_id: string
          id: string
          notes: string | null
          performed_by: string
          quantity_produced: number
          recipe_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          finished_product_id: string
          id?: string
          notes?: string | null
          performed_by: string
          quantity_produced: number
          recipe_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          finished_product_id?: string
          id?: string
          notes?: string | null
          performed_by?: string
          quantity_produced?: number
          recipe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "finished_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          category: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          recipe_id: string
          unit: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          recipe_id: string
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          active: boolean
          created_at: string
          finished_product_id: string
          id: string
          notes: string | null
          updated_at: string
          version: number
          yield_quantity: number
          yield_unit: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          finished_product_id: string
          id?: string
          notes?: string | null
          updated_at?: string
          version?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          finished_product_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
          version?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "finished_products"
            referencedColumns: ["id"]
          },
        ]
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
          source: string | null
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
          source?: string | null
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
          source?: string | null
          type?: string
          unit_used?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "operator" | "viewer"
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
    Enums: {
      app_role: ["admin", "manager", "operator", "viewer"],
    },
  },
} as const
