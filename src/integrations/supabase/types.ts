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
      companies: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          deal_id: string
          id: string
          kind: string
          meta: Json
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          deal_id: string
          id?: string
          kind: string
          meta?: Json
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          kind?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_company: string | null
          client_email: string
          client_name: string
          company_id: string
          created_at: string
          estimated_value: number
          event_date: string | null
          event_type: string | null
          guest_count: number
          id: string
          notes: string | null
          owner_id: string
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
        }
        Insert: {
          client_company?: string | null
          client_email: string
          client_name: string
          company_id: string
          created_at?: string
          estimated_value?: number
          event_date?: string | null
          event_type?: string | null
          guest_count?: number
          id?: string
          notes?: string | null
          owner_id: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
        }
        Update: {
          client_company?: string | null
          client_email?: string
          client_name?: string
          company_id?: string
          created_at?: string
          estimated_value?: number
          event_date?: string | null
          event_type?: string | null
          guest_count?: number
          id?: string
          notes?: string | null
          owner_id?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      extras: {
        Row: {
          active: boolean
          basis: string | null
          category: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          long_description: string | null
          name: string
          price: number
          pricing_type: Database["public"]["Enums"]["extra_pricing_type"]
          tax_rate_pct: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          basis?: string | null
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          long_description?: string | null
          name: string
          price?: number
          pricing_type?: Database["public"]["Enums"]["extra_pricing_type"]
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          basis?: string | null
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          long_description?: string | null
          name?: string
          price?: number
          pricing_type?: Database["public"]["Enums"]["extra_pricing_type"]
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_packages: {
        Row: {
          active: boolean
          allergen_notes: string | null
          basis: string | null
          category: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          included_hours: number | null
          kind: string
          long_description: string | null
          min_guests: number
          name: string
          overage_price_per_person_per_hour: number
          price_per_person: number
          tax_rate_pct: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allergen_notes?: string | null
          basis?: string | null
          category?: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          included_hours?: number | null
          kind?: string
          long_description?: string | null
          min_guests?: number
          name: string
          overage_price_per_person_per_hour?: number
          price_per_person?: number
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allergen_notes?: string | null
          basis?: string | null
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          included_hours?: number | null
          kind?: string
          long_description?: string | null
          min_guests?: number
          name?: string
          overage_price_per_person_per_hour?: number
          price_per_person?: number
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_config: {
        Row: {
          cleaning_fee: number
          company_id: string
          default_basis_beverage: string
          default_basis_extra: string
          default_basis_food: string
          default_basis_rental: string
          default_hours_beverage: number
          default_hours_food: number
          gratuity_default_pct: number
          gratuity_fixed_pct: number
          gratuity_max_pct: number
          gratuity_min_pct: number
          gratuity_mode: string
          gratuity_tax_rate_pct: number
          gratuity_type: string
          overtime_fee_per_hour: number
          service_charge_pct: number
          tax_pct: number
          tax_rate_beverage: number
          tax_rate_extra: number
          tax_rate_food: number
          tax_rate_rental: number
          updated_at: string
        }
        Insert: {
          cleaning_fee?: number
          company_id: string
          default_basis_beverage?: string
          default_basis_extra?: string
          default_basis_food?: string
          default_basis_rental?: string
          default_hours_beverage?: number
          default_hours_food?: number
          gratuity_default_pct?: number
          gratuity_fixed_pct?: number
          gratuity_max_pct?: number
          gratuity_min_pct?: number
          gratuity_mode?: string
          gratuity_tax_rate_pct?: number
          gratuity_type?: string
          overtime_fee_per_hour?: number
          service_charge_pct?: number
          tax_pct?: number
          tax_rate_beverage?: number
          tax_rate_extra?: number
          tax_rate_food?: number
          tax_rate_rental?: number
          updated_at?: string
        }
        Update: {
          cleaning_fee?: number
          company_id?: string
          default_basis_beverage?: string
          default_basis_extra?: string
          default_basis_food?: string
          default_basis_rental?: string
          default_hours_beverage?: number
          default_hours_food?: number
          gratuity_default_pct?: number
          gratuity_fixed_pct?: number
          gratuity_max_pct?: number
          gratuity_min_pct?: number
          gratuity_mode?: string
          gratuity_tax_rate_pct?: number
          gratuity_type?: string
          overtime_fee_per_hour?: number
          service_charge_pct?: number
          tax_pct?: number
          tax_rate_beverage?: number
          tax_rate_extra?: number
          tax_rate_food?: number
          tax_rate_rental?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          basis: string
          company_id: string
          created_at: string
          day_of_week: number | null
          days_of_week: number[]
          id: string
          min_revenue: number
          month: number | null
          months: number[]
          notes: string | null
          space_id: string | null
        }
        Insert: {
          basis?: string
          company_id: string
          created_at?: string
          day_of_week?: number | null
          days_of_week?: number[]
          id?: string
          min_revenue?: number
          month?: number | null
          months?: number[]
          notes?: string | null
          space_id?: string | null
        }
        Update: {
          basis?: string
          company_id?: string
          created_at?: string
          day_of_week?: number | null
          days_of_week?: number[]
          id?: string
          min_revenue?: number
          month?: number | null
          months?: number[]
          notes?: string | null
          space_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_seasons: {
        Row: {
          basis: string
          company_id: string
          created_at: string
          days_of_week: number[]
          end_date: string
          id: string
          multiplier: number
          name: string
          start_date: string
        }
        Insert: {
          basis?: string
          company_id: string
          created_at?: string
          days_of_week?: number[]
          end_date: string
          id?: string
          multiplier?: number
          name: string
          start_date: string
        }
        Update: {
          basis?: string
          company_id?: string
          created_at?: string
          days_of_week?: number[]
          end_date?: string
          id?: string
          multiplier?: number
          name?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_seasons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_selections: {
        Row: {
          company_id: string
          computed_total: number
          id: string
          proposal_id: string
          selection: Json
          submitted_at: string
        }
        Insert: {
          company_id: string
          computed_total?: number
          id?: string
          proposal_id: string
          selection?: Json
          submitted_at?: string
        }
        Update: {
          company_id?: string
          computed_total?: number
          id?: string
          proposal_id?: string
          selection?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_selections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_selections_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          company_id: string
          constraints: Json
          created_at: string
          deal_id: string
          id: string
          offer: Json
          sent_at: string | null
          status: string
          version: number
        }
        Insert: {
          company_id: string
          constraints?: Json
          created_at?: string
          deal_id: string
          id?: string
          offer?: Json
          sent_at?: string | null
          status?: string
          version?: number
        }
        Update: {
          company_id?: string
          constraints?: Json
          created_at?: string
          deal_id?: string
          id?: string
          offer?: Json
          sent_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      share_tokens: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          expires_at: string | null
          kind: Database["public"]["Enums"]["share_token_kind"]
          proposal_id: string | null
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          expires_at?: string | null
          kind: Database["public"]["Enums"]["share_token_kind"]
          proposal_id?: string | null
          token: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          expires_at?: string | null
          kind?: Database["public"]["Enums"]["share_token_kind"]
          proposal_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_tokens_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_tokens_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          active: boolean
          available_days: number[]
          base_rental_fee: number
          basis: string | null
          capacity: number
          capacity_seated: number | null
          capacity_standing: number | null
          company_id: string
          created_at: string
          description: string | null
          details_url: string | null
          features: string[]
          id: string
          long_description: string | null
          min_rental_fee: number
          name: string
          photo_url: string | null
          tax_rate_pct: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_days?: number[]
          base_rental_fee?: number
          basis?: string | null
          capacity?: number
          capacity_seated?: number | null
          capacity_standing?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          details_url?: string | null
          features?: string[]
          id?: string
          long_description?: string | null
          min_rental_fee?: number
          name: string
          photo_url?: string | null
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_days?: number[]
          base_rental_fee?: number
          basis?: string | null
          capacity?: number
          capacity_seated?: number | null
          capacity_standing?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          details_url?: string | null
          features?: string[]
          id?: string
          long_description?: string | null
          min_rental_fee?: number
          name?: string
          photo_url?: string | null
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_company_workspace: {
        Args: { _currency: string; _name: string; _primary_color: string }
        Returns: string
      }
      is_member_of: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_company_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "owner" | "manager" | "sales"
      deal_stage:
        | "inquiry"
        | "proposal_draft"
        | "proposal_sent"
        | "client_selected"
        | "manager_review"
        | "accepted"
        | "lost"
        | "new"
        | "contacted"
        | "meeting_scheduled"
        | "signed"
        | "waiting_payment"
        | "invoice_sent"
        | "downpayment_received"
        | "paid_in_full"
        | "payment_delayed"
      extra_pricing_type: "per_person" | "flat" | "per_hour"
      share_token_kind: "client_proposal" | "dashboard" | "preview"
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
      app_role: ["owner", "manager", "sales"],
      deal_stage: [
        "inquiry",
        "proposal_draft",
        "proposal_sent",
        "client_selected",
        "manager_review",
        "accepted",
        "lost",
        "new",
        "contacted",
        "meeting_scheduled",
        "signed",
        "waiting_payment",
        "invoice_sent",
        "downpayment_received",
        "paid_in_full",
        "payment_delayed",
      ],
      extra_pricing_type: ["per_person", "flat", "per_hour"],
      share_token_kind: ["client_proposal", "dashboard", "preview"],
    },
  },
} as const
