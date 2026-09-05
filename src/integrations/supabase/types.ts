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
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
          quantity?: number | null
          updated_at?: string
          visa_manager?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autocontrols_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_logs: {
        Row: {
          collaborateur: string
          created_at: string
          id: string
          log_date: string
          notes: string | null
          pdv_id: string
          tasks: Json
          updated_at: string
          visa_manager: string | null
          zone: string
        }
        Insert: {
          collaborateur: string
          created_at?: string
          id?: string
          log_date: string
          notes?: string | null
          pdv_id?: string
          tasks?: Json
          updated_at?: string
          visa_manager?: string | null
          zone: string
        }
        Update: {
          collaborateur?: string
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          pdv_id?: string
          tasks?: Json
          updated_at?: string
          visa_manager?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_logs_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      ecart_entries: {
        Row: {
          categorie: string
          created_at: string
          entrees: number
          entry_date: string
          id: string
          notes: string | null
          pdv_id: string
          performed_by: string | null
          produit: string
          stock_final: number
          stock_initial: number
          updated_at: string
          ventes: number
          zone: string
        }
        Insert: {
          categorie?: string
          created_at?: string
          entrees?: number
          entry_date: string
          id?: string
          notes?: string | null
          pdv_id: string
          performed_by?: string | null
          produit: string
          stock_final?: number
          stock_initial?: number
          updated_at?: string
          ventes?: number
          zone?: string
        }
        Update: {
          categorie?: string
          created_at?: string
          entrees?: number
          entry_date?: string
          id?: string
          notes?: string | null
          pdv_id?: string
          performed_by?: string | null
          produit?: string
          stock_final?: number
          stock_initial?: number
          updated_at?: string
          ventes?: number
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecart_entries_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      ecart_lines: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          item: string
          pdv_id: string
          qty: number
          section: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          item: string
          pdv_id: string
          qty?: number
          section: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          item?: string
          pdv_id?: string
          qty?: number
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecart_lines_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
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
      fridge_equipments: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          pdv_id: string
          sort_order: number
          type: string
          updated_at: string
          zone: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          pdv_id: string
          sort_order?: number
          type: string
          updated_at?: string
          zone: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          pdv_id?: string
          sort_order?: number
          type?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "fridge_equipments_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
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
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
          performed_by?: string
          slot?: string
          temperature_bas?: number | null
          temperature_haut?: number | null
          updated_at?: string
          visa_manager?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "fridge_temperatures_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
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
      glace_storage_capacity: {
        Row: {
          article: string
          capacity: number | null
          updated_at: string
        }
        Insert: {
          article: string
          capacity?: number | null
          updated_at?: string
        }
        Update: {
          article?: string
          capacity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      glace_stuff_controls: {
        Row: {
          action_corrective: string | null
          anomalie: string | null
          collaborateur: string | null
          control_date: string
          created_at: string
          id: string
          line_index: number
          lot_number: string | null
          non_conformite: boolean | null
          notes: string | null
          parfum: string | null
          pdv_id: string
          plastique: boolean | null
          slot: string
          updated_at: string
          visa_manager: string | null
          zone: string
        }
        Insert: {
          action_corrective?: string | null
          anomalie?: string | null
          collaborateur?: string | null
          control_date: string
          created_at?: string
          id?: string
          line_index?: number
          lot_number?: string | null
          non_conformite?: boolean | null
          notes?: string | null
          parfum?: string | null
          pdv_id?: string
          plastique?: boolean | null
          slot: string
          updated_at?: string
          visa_manager?: string | null
          zone?: string
        }
        Update: {
          action_corrective?: string | null
          anomalie?: string | null
          collaborateur?: string | null
          control_date?: string
          created_at?: string
          id?: string
          line_index?: number
          lot_number?: string | null
          non_conformite?: boolean | null
          notes?: string | null
          parfum?: string | null
          pdv_id?: string
          plastique?: boolean | null
          slot?: string
          updated_at?: string
          visa_manager?: string | null
          zone?: string
        }
        Relationships: []
      }
      initial_stocks: {
        Row: {
          carton_enabled: boolean
          created_at: string
          id: string
          min_quantity: number
          paquet_enabled: boolean
          pdv_id: string
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
          min_quantity?: number
          paquet_enabled?: boolean
          pdv_id?: string
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
          min_quantity?: number
          paquet_enabled?: boolean
          pdv_id?: string
          pieces_per_carton?: number
          pieces_per_paquet?: number
          product_id?: string
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initial_stocks_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          counted_by_user_id: string
          counter_slot: string
          id: string
          line_id: string
          mise_en_place_qty: number | null
          pdv_id: string
          session_id: string
          stock_qty: number | null
          updated_at: string
        }
        Insert: {
          counted_by_user_id: string
          counter_slot: string
          id?: string
          line_id: string
          mise_en_place_qty?: number | null
          pdv_id?: string
          session_id: string
          stock_qty?: number | null
          updated_at?: string
        }
        Update: {
          counted_by_user_id?: string
          counter_slot?: string
          id?: string
          line_id?: string
          mise_en_place_qty?: number | null
          pdv_id?: string
          session_id?: string
          stock_qty?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "inventory_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lines: {
        Row: {
          category: string
          created_at: string
          id: string
          lot_id: string | null
          lot_number: string | null
          pdv_id: string
          product_id: string
          product_name: string
          session_id: string
          sort_order: number
          theoretical_qty: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          lot_id?: string | null
          lot_number?: string | null
          pdv_id?: string
          product_id: string
          product_name: string
          session_id: string
          sort_order?: number
          theoretical_qty?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          lot_id?: string | null
          lot_number?: string | null
          pdv_id?: string
          product_id?: string
          product_name?: string
          session_id?: string
          sort_order?: number
          theoretical_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lines_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_resolutions: {
        Row: {
          final_mise_en_place_qty: number | null
          final_stock_qty: number | null
          id: string
          line_id: string
          pdv_id: string
          resolved_at: string
          resolved_by: string | null
          session_id: string
          variance_vs_theoretical: number | null
        }
        Insert: {
          final_mise_en_place_qty?: number | null
          final_stock_qty?: number | null
          id?: string
          line_id: string
          pdv_id?: string
          resolved_at?: string
          resolved_by?: string | null
          session_id: string
          variance_vs_theoretical?: number | null
        }
        Update: {
          final_mise_en_place_qty?: number | null
          final_stock_qty?: number | null
          id?: string
          line_id?: string
          pdv_id?: string
          resolved_at?: string
          resolved_by?: string | null
          session_id?: string
          variance_vs_theoretical?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_resolutions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "inventory_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_resolutions_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_resolutions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sessions: {
        Row: {
          closed_at: string | null
          counter_a_done: boolean
          counter_a_user_id: string | null
          counter_b_done: boolean
          counter_b_user_id: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          pdv_id: string
          session_date: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          counter_a_done?: boolean
          counter_a_user_id?: string | null
          counter_b_done?: boolean
          counter_b_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          pdv_id?: string
          session_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          counter_a_done?: boolean
          counter_a_user_id?: string | null
          counter_b_done?: boolean
          counter_b_user_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          pdv_id?: string
          session_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sessions_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_entries: {
        Row: {
          created_at: string
          entry_date: string
          expiry_date: string
          id: string
          lot_number: string
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
          product_id?: string
          quantity?: number
          remaining_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "lot_entries_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_placed_products: {
        Row: {
          marked_at: string
          marked_by: string | null
          pdv_id: string
          product_id: string
        }
        Insert: {
          marked_at?: string
          marked_by?: string | null
          pdv_id?: string
          product_id: string
        }
        Update: {
          marked_at?: string
          marked_by?: string | null
          pdv_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_placed_products_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          pdv_id: string
          permission_key: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          pdv_id: string
          permission_key: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          pdv_id?: string
          permission_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_permissions_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      pdvs: {
        Row: {
          access_code: string
          active: boolean
          code: string
          created_at: string
          default_role: Database["public"]["Enums"]["app_role"]
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          access_code?: string
          active?: boolean
          code: string
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          active?: boolean
          code?: string
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pep_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          label: string
          pdv_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          label: string
          pdv_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          label?: string
          pdv_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pep_holidays_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_occurrences: {
        Row: {
          comment: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          due_date: string
          id: string
          original_due_date: string
          pdv_id: string
          photo_before_url: string | null
          photo_url: string | null
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date: string
          id?: string
          original_due_date: string
          pdv_id: string
          photo_before_url?: string | null
          photo_url?: string | null
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string
          id?: string
          original_due_date?: string
          pdv_id?: string
          photo_before_url?: string | null
          photo_url?: string | null
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pep_occurrences_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pep_occurrences_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pep_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_postponements: {
        Row: {
          created_at: string
          from_date: string
          id: string
          occurrence_id: string
          pdv_id: string
          postponed_by: string | null
          postponed_by_name: string | null
          reason: string | null
          task_id: string
          to_date: string
        }
        Insert: {
          created_at?: string
          from_date: string
          id?: string
          occurrence_id: string
          pdv_id: string
          postponed_by?: string | null
          postponed_by_name?: string | null
          reason?: string | null
          task_id: string
          to_date: string
        }
        Update: {
          created_at?: string
          from_date?: string
          id?: string
          occurrence_id?: string
          pdv_id?: string
          postponed_by?: string | null
          postponed_by_name?: string | null
          reason?: string | null
          task_id?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pep_postponements_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "pep_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pep_postponements_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pep_postponements_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pep_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pep_tasks: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          equipment: string | null
          frequency: string
          id: string
          name: string
          next_due_date: string | null
          notes: string | null
          pdv_id: string
          requires_photo: boolean
          requires_photo_before_after: boolean
          responsable: string | null
          start_date: string
          updated_at: string
          weekend_allowed: boolean
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          equipment?: string | null
          frequency: string
          id?: string
          name: string
          next_due_date?: string | null
          notes?: string | null
          pdv_id: string
          requires_photo?: boolean
          requires_photo_before_after?: boolean
          responsable?: string | null
          start_date?: string
          updated_at?: string
          weekend_allowed?: boolean
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          equipment?: string | null
          frequency?: string
          id?: string
          name?: string
          next_due_date?: string | null
          notes?: string | null
          pdv_id?: string
          requires_photo?: boolean
          requires_photo_before_after?: boolean
          responsable?: string | null
          start_date?: string
          updated_at?: string
          weekend_allowed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pep_tasks_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          category: string
          conditionnement: string
          created_at: string
          hidden: boolean
          id: string
          name: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          conditionnement?: string
          created_at?: string
          hidden?: boolean
          id?: string
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          conditionnement?: string
          created_at?: string
          hidden?: boolean
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
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
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
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
            foreignKeyName: "production_entries_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
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
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
          performed_by?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          type?: string
          unit_used?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_names: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          pdv_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          pdv_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          pdv_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_names_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_orders: {
        Row: {
          category: string
          created_at: string
          id: string
          items: Json
          notes: string | null
          order_date: string
          pdv_id: string
          performed_by: string | null
          total_items: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          order_date: string
          pdv_id?: string
          performed_by?: string | null
          total_items?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          order_date?: string
          pdv_id?: string
          performed_by?: string | null
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "saved_orders_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          category: string
          created_at: string
          date: string
          destination: string | null
          id: string
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
          performed_by?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          source?: string | null
          type?: string
          unit_used?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ref_conversions: {
        Row: {
          conversion: string
          product_id: string
          unit_ref: string
          updated_at: string
        }
        Insert: {
          conversion?: string
          product_id: string
          unit_ref?: string
          updated_at?: string
        }
        Update: {
          conversion?: string
          product_id?: string
          unit_ref?: string
          updated_at?: string
        }
        Relationships: []
      }
      tech_issue_events: {
        Row: {
          actor_name: string | null
          actor_user: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          issue_id: string
          pdv_id: string
        }
        Insert: {
          actor_name?: string | null
          actor_user?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          issue_id: string
          pdv_id: string
        }
        Update: {
          actor_name?: string | null
          actor_user?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          issue_id?: string
          pdv_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "tech_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_issue_events_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_issues: {
        Row: {
          action_done: string | null
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          deadline: string | null
          equipment: string
          id: string
          location: string | null
          manager_comment: string | null
          manager_validated_at: string | null
          manager_validated_by: string | null
          pdv_id: string
          photo_url: string | null
          priority: string
          problem: string
          repair_photo_url: string | null
          repaired_at: string | null
          reported_at: string
          reported_by: string
          reported_by_user: string | null
          source_occurrence_id: string | null
          source_task_id: string | null
          status: string
          taken_at: string | null
          tech_comment: string | null
          tech_notes: string | null
          tech_validated_at: string | null
          tech_validated_by: string | null
          updated_at: string
        }
        Insert: {
          action_done?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          deadline?: string | null
          equipment: string
          id?: string
          location?: string | null
          manager_comment?: string | null
          manager_validated_at?: string | null
          manager_validated_by?: string | null
          pdv_id: string
          photo_url?: string | null
          priority?: string
          problem: string
          repair_photo_url?: string | null
          repaired_at?: string | null
          reported_at?: string
          reported_by: string
          reported_by_user?: string | null
          source_occurrence_id?: string | null
          source_task_id?: string | null
          status?: string
          taken_at?: string | null
          tech_comment?: string | null
          tech_notes?: string | null
          tech_validated_at?: string | null
          tech_validated_by?: string | null
          updated_at?: string
        }
        Update: {
          action_done?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          deadline?: string | null
          equipment?: string
          id?: string
          location?: string | null
          manager_comment?: string | null
          manager_validated_at?: string | null
          manager_validated_by?: string | null
          pdv_id?: string
          photo_url?: string | null
          priority?: string
          problem?: string
          repair_photo_url?: string | null
          repaired_at?: string | null
          reported_at?: string
          reported_by?: string
          reported_by_user?: string | null
          source_occurrence_id?: string | null
          source_task_id?: string | null
          status?: string
          taken_at?: string | null
          tech_comment?: string | null
          tech_notes?: string | null
          tech_validated_at?: string | null
          tech_validated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_issues_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_issues_source_occurrence_id_fkey"
            columns: ["source_occurrence_id"]
            isOneToOne: false
            referencedRelation: "pep_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_issues_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "pep_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pdvs: {
        Row: {
          created_at: string
          id: string
          pdv_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdv_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pdv_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pdvs_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
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
          pdv_id: string
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
          pdv_id?: string
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
          pdv_id?: string
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
        Relationships: [
          {
            foreignKeyName: "weekly_tracking_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_transfers: {
        Row: {
          article: string | null
          created_at: string
          direction: string
          fiche_type: string
          id: string
          location: string | null
          lot_number: string | null
          notes: string | null
          pdv_id: string
          performed_by: string | null
          quantity: number | null
          transfer_date: string
          updated_at: string
          week_start: string
        }
        Insert: {
          article?: string | null
          created_at?: string
          direction: string
          fiche_type: string
          id?: string
          location?: string | null
          lot_number?: string | null
          notes?: string | null
          pdv_id: string
          performed_by?: string | null
          quantity?: number | null
          transfer_date: string
          updated_at?: string
          week_start: string
        }
        Update: {
          article?: string | null
          created_at?: string
          direction?: string
          fiche_type?: string
          id?: string
          location?: string | null
          lot_number?: string | null
          notes?: string | null
          pdv_id?: string
          performed_by?: string | null
          quantity?: number | null
          transfer_date?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_transfers_pdv_id_fkey"
            columns: ["pdv_id"]
            isOneToOne: false
            referencedRelation: "pdvs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_pdv: {
        Args: { _pdv_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_tech: {
        Args: { _pdv_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_inventory: { Args: { _user_id: string }; Returns: boolean }
      can_manage_pdv_permission: {
        Args: { _pdv_id: string; _permission_key: string; _user_id: string }
        Returns: boolean
      }
      can_participate_inventory: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
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
      inv_mark_counter_done: {
        Args: { _session_id: string; _slot: string }
        Returns: undefined
      }
      inventory_session_status: {
        Args: { _session_id: string }
        Returns: string
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_regional_admin: { Args: { _user_id: string }; Returns: boolean }
      stock_movement_aggregates:
        | {
            Args: never
            Returns: {
              entrees: number
              entrees_all: number
              product_id: string
              regularisations_net: number
              sorties: number
              sorties_all: number
            }[]
          }
        | {
            Args: { _pdv_id: string }
            Returns: {
              category: string
              entrees: number
              entrees_all: number
              product_id: string
              product_name: string
              regularisations_net: number
              sorties: number
              sorties_all: number
            }[]
          }
      stock_period_aggregates: {
        Args: { _end_date: string; _pdv_id: string; _start_date: string }
        Returns: {
          entrees: number
          product_id: string
          sorties: number
          stock_initial: number
          stock_restant: number
        }[]
      }
      tech_manager_validate: {
        Args: {
          _comment?: string
          _issue_id: string
          _manager_name: string
          _ok?: boolean
        }
        Returns: undefined
      }
      user_pdv_ids: { Args: { _user_id: string }; Returns: string[] }
      verify_pdv_code: {
        Args: { _code: string; _pdv_id: string }
        Returns: boolean
      }
      weekly_tracking_filtered: {
        Args: {
          _articles?: string[]
          _fiche_type: string
          _from_week?: string
          _pdv_id: string
          _to_week?: string
        }
        Returns: {
          article: string
          day_of_week: string
          entrees: number
          row_index: number
          sorties: number
          stock_initial: number
          week_start: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "operator" | "viewer" | "regional_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "manager", "operator", "viewer", "regional_admin"],
    },
  },
} as const
