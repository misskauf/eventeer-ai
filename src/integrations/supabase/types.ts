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
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          cost_visible_roles: string[]
          created_at: string
          created_by: string
          currency: string
          default_deal_language: string
          id: string
          invoice_mode: string
          invoice_notes: string | null
          logo_url: string | null
          name: string
          primary_color: string
          proposal_reminder_days: number
          require_deal_approval: boolean
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cost_visible_roles?: string[]
          created_at?: string
          created_by: string
          currency?: string
          default_deal_language?: string
          id?: string
          invoice_mode?: string
          invoice_notes?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string
          proposal_reminder_days?: number
          require_deal_approval?: boolean
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cost_visible_roles?: string[]
          created_at?: string
          created_by?: string
          currency?: string
          default_deal_language?: string
          id?: string
          invoice_mode?: string
          invoice_notes?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string
          proposal_reminder_days?: number
          require_deal_approval?: boolean
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          is_default: boolean
          language: string
          name: string
          updated_at: string
        }
        Insert: {
          body?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_default?: boolean
          language?: string
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_default?: boolean
          language?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          rendered_body: string
          sent_at: string | null
          sent_to_email: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by_email: string | null
          signed_by_name: string | null
          signed_ip: string | null
          signed_place: string | null
          signing_token: string | null
          signing_token_expires_at: string | null
          status: string
          template_id: string | null
          template_name: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          rendered_body?: string
          sent_at?: string | null
          sent_to_email?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          signed_ip?: string | null
          signed_place?: string | null
          signing_token?: string | null
          signing_token_expires_at?: string | null
          status?: string
          template_id?: string | null
          template_name?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          rendered_body?: string
          sent_at?: string | null
          sent_to_email?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          signed_ip?: string | null
          signed_place?: string | null
          signing_token?: string | null
          signing_token_expires_at?: string | null
          status?: string
          template_id?: string | null
          template_name?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
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
      deal_items: {
        Row: {
          captured_at: string
          company_id: string
          created_at: string
          deal_id: string
          id: string
          item_id: string | null
          item_name: string
          item_type: string
          line_cost: number
          line_gross: number
          line_total: number
          proposal_id: string | null
          qty: number
          space_id: string | null
          unit_cost: number
          unit_price: number
        }
        Insert: {
          captured_at?: string
          company_id: string
          created_at?: string
          deal_id: string
          id?: string
          item_id?: string | null
          item_name: string
          item_type: string
          line_cost?: number
          line_gross?: number
          line_total?: number
          proposal_id?: string | null
          qty?: number
          space_id?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          captured_at?: string
          company_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          item_id?: string | null
          item_name?: string
          item_type?: string
          line_cost?: number
          line_gross?: number
          line_total?: number
          proposal_id?: string | null
          qty?: number
          space_id?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          approval_note: string | null
          approval_requested_at: string | null
          approval_requested_by: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          client_company: string | null
          client_email: string
          client_name: string
          company_id: string
          consent_given_at: string | null
          consent_text: string | null
          created_at: string
          custom_fields: Json
          estimated_value: number
          event_date: string | null
          event_type: string | null
          guest_count: number
          id: string
          language: string
          lead_form_id: string | null
          notes: string | null
          owner_id: string
          source: string
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
        }
        Insert: {
          approval_note?: string | null
          approval_requested_at?: string | null
          approval_requested_by?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          client_company?: string | null
          client_email: string
          client_name: string
          company_id: string
          consent_given_at?: string | null
          consent_text?: string | null
          created_at?: string
          custom_fields?: Json
          estimated_value?: number
          event_date?: string | null
          event_type?: string | null
          guest_count?: number
          id?: string
          language?: string
          lead_form_id?: string | null
          notes?: string | null
          owner_id: string
          source?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
        }
        Update: {
          approval_note?: string | null
          approval_requested_at?: string | null
          approval_requested_by?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          client_company?: string | null
          client_email?: string
          client_name?: string
          company_id?: string
          consent_given_at?: string | null
          consent_text?: string | null
          created_at?: string
          custom_fields?: Json
          estimated_value?: number
          event_date?: string | null
          event_type?: string | null
          guest_count?: number
          id?: string
          language?: string
          lead_form_id?: string | null
          notes?: string | null
          owner_id?: string
          source?: string
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
          {
            foreignKeyName: "deals_lead_form_id_fkey"
            columns: ["lead_form_id"]
            isOneToOne: false
            referencedRelation: "lead_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      event_briefs: {
        Row: {
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          deal_id: string
          generated_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          body?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          generated_at?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          generated_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_briefs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_briefs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
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
          cost: number | null
          created_at: string
          description: string | null
          id: string
          long_description: string | null
          long_description_de: string | null
          name: string
          name_de: string | null
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
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          long_description?: string | null
          long_description_de?: string | null
          name: string
          name_de?: string | null
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
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          long_description?: string | null
          long_description_de?: string | null
          name?: string
          name_de?: string | null
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
          cost: number | null
          created_at: string
          description: string | null
          details_url: string | null
          event_types: string[]
          id: string
          included_hours: number | null
          kind: string
          long_description: string | null
          long_description_de: string | null
          min_guests: number
          name: string
          name_de: string | null
          overage_price_per_person_per_hour: number
          price_per_person: number
          selection_groups: Json
          selection_mode: string
          selection_total_max: number | null
          tax_rate_pct: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allergen_notes?: string | null
          basis?: string | null
          category?: string
          company_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          details_url?: string | null
          event_types?: string[]
          id?: string
          included_hours?: number | null
          kind?: string
          long_description?: string | null
          long_description_de?: string | null
          min_guests?: number
          name: string
          name_de?: string | null
          overage_price_per_person_per_hour?: number
          price_per_person?: number
          selection_groups?: Json
          selection_mode?: string
          selection_total_max?: number | null
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allergen_notes?: string | null
          basis?: string | null
          category?: string
          company_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          details_url?: string | null
          event_types?: string[]
          id?: string
          included_hours?: number | null
          kind?: string
          long_description?: string | null
          long_description_de?: string | null
          min_guests?: number
          name?: string
          name_de?: string | null
          overage_price_per_person_per_hour?: number
          price_per_person?: number
          selection_groups?: Json
          selection_mode?: string
          selection_total_max?: number | null
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
          default_basis_staff: string
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
          tax_rate_staff: number
          updated_at: string
        }
        Insert: {
          cleaning_fee?: number
          company_id: string
          default_basis_beverage?: string
          default_basis_extra?: string
          default_basis_food?: string
          default_basis_rental?: string
          default_basis_staff?: string
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
          tax_rate_staff?: number
          updated_at?: string
        }
        Update: {
          cleaning_fee?: number
          company_id?: string
          default_basis_beverage?: string
          default_basis_extra?: string
          default_basis_food?: string
          default_basis_rental?: string
          default_basis_staff?: string
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
          tax_rate_staff?: number
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
      invoice_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body?: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          body_html: string
          company_id: string
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          issued_at: string | null
          mode: string
          status: string
          template_id: string | null
          template_name: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          issued_at?: string | null
          mode?: string
          status?: string
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          issued_at?: string | null
          mode?: string
          status?: string
          template_id?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_forms: {
        Row: {
          active: boolean
          company_id: string
          consent_text: string
          created_at: string
          fields: Json
          id: string
          intro_text: string | null
          name: string
          redirect_url: string | null
          slug: string
          success_text: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          consent_text?: string
          created_at?: string
          fields?: Json
          id?: string
          intro_text?: string | null
          name: string
          redirect_url?: string | null
          slug: string
          success_text?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          consent_text?: string
          created_at?: string
          fields?: Json
          id?: string
          intro_text?: string | null
          name?: string
          redirect_url?: string | null
          slug?: string
          success_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_forms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          company_id: string
          created_at: string
          deal_id: string | null
          id: string
          kind: string
          read_at: string | null
          recipient_user_id: string | null
          title: string
        }
        Insert: {
          body?: string
          company_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          kind: string
          read_at?: string | null
          recipient_user_id?: string | null
          title: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          recipient_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          created_at: string
          detail: Json
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id: string
          created_at?: string
          detail?: Json
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          created_at?: string
          detail?: Json
          id?: string
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
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
          space_ids: string[]
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
          space_ids?: string[]
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
          space_ids?: string[]
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
          client_action: string | null
          company_id: string
          computed_total: number
          id: string
          menu_choices: Json
          proposal_id: string
          selection: Json
          submitted_at: string
        }
        Insert: {
          client_action?: string | null
          company_id: string
          computed_total?: number
          id?: string
          menu_choices?: Json
          proposal_id: string
          selection?: Json
          submitted_at?: string
        }
        Update: {
          client_action?: string | null
          company_id?: string
          computed_total?: number
          id?: string
          menu_choices?: Json
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
      role_permissions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          level: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          scope: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          level?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          level?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          cost: number | null
          created_at: string
          description: string | null
          details_url: string | null
          event_types: string[]
          features: string[]
          id: string
          long_description: string | null
          long_description_de: string | null
          min_rental_fee: number
          name: string
          name_de: string | null
          photo_url: string | null
          tax_rate_pct: number | null
          updated_at: string
          weekday_pricing: Json
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
          cost?: number | null
          created_at?: string
          description?: string | null
          details_url?: string | null
          event_types?: string[]
          features?: string[]
          id?: string
          long_description?: string | null
          long_description_de?: string | null
          min_rental_fee?: number
          name: string
          name_de?: string | null
          photo_url?: string | null
          tax_rate_pct?: number | null
          updated_at?: string
          weekday_pricing?: Json
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
          cost?: number | null
          created_at?: string
          description?: string | null
          details_url?: string | null
          event_types?: string[]
          features?: string[]
          id?: string
          long_description?: string | null
          long_description_de?: string | null
          min_rental_fee?: number
          name?: string
          name_de?: string | null
          photo_url?: string | null
          tax_rate_pct?: number | null
          updated_at?: string
          weekday_pricing?: Json
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
      staff_roles: {
        Row: {
          active: boolean
          basis: string | null
          category: string
          company_id: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          long_description: string | null
          long_description_de: string | null
          name: string
          name_de: string | null
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
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          long_description?: string | null
          long_description_de?: string | null
          name: string
          name_de?: string | null
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
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          long_description?: string | null
          long_description_de?: string | null
          name?: string
          name_de?: string | null
          price?: number
          pricing_type?: Database["public"]["Enums"]["extra_pricing_type"]
          tax_rate_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          user_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
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
      deal_items_visible: {
        Row: {
          captured_at: string | null
          company_id: string | null
          created_at: string | null
          deal_id: string | null
          id: string | null
          item_id: string | null
          item_name: string | null
          item_type: string | null
          line_cost: number | null
          line_gross: number | null
          line_total: number | null
          proposal_id: string | null
          qty: number | null
          space_id: string | null
          unit_cost: number | null
          unit_price: number | null
        }
        Insert: {
          captured_at?: string | null
          company_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string | null
          item_id?: string | null
          item_name?: string | null
          item_type?: string | null
          line_cost?: never
          line_gross?: number | null
          line_total?: number | null
          proposal_id?: string | null
          qty?: number | null
          space_id?: string | null
          unit_cost?: never
          unit_price?: number | null
        }
        Update: {
          captured_at?: string | null
          company_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          id?: string | null
          item_id?: string | null
          item_name?: string | null
          item_type?: string | null
          line_cost?: never
          line_gross?: number | null
          line_total?: number | null
          proposal_id?: string | null
          qty?: number | null
          space_id?: string | null
          unit_cost?: never
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_costs: { Args: { _user_id: string }; Returns: boolean }
      create_company_workspace: {
        Args: { _currency: string; _name: string; _primary_color: string }
        Returns: string
      }
      has_permission: {
        Args: { _company_id: string; _min_level: string; _module: string }
        Returns: boolean
      }
      is_member_of: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      permission_level: {
        Args: { _company_id: string; _module: string }
        Returns: string
      }
      seed_role_permissions: {
        Args: { _company_id: string }
        Returns: undefined
      }
      user_company_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "sales"
        | "accounting"
        | "sales_manager"
        | "event_manager"
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
        | "client_approved"
        | "signed"
        | "waiting_payment"
        | "invoice_sent"
        | "downpayment_received"
        | "paid_in_full"
        | "payment_delayed"
        | "changes_requested"
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
      app_role: [
        "owner",
        "manager",
        "sales",
        "accounting",
        "sales_manager",
        "event_manager",
      ],
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
        "client_approved",
        "signed",
        "waiting_payment",
        "invoice_sent",
        "downpayment_received",
        "paid_in_full",
        "payment_delayed",
        "changes_requested",
      ],
      extra_pricing_type: ["per_person", "flat", "per_hour"],
      share_token_kind: ["client_proposal", "dashboard", "preview"],
    },
  },
} as const
