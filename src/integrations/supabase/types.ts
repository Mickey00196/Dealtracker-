export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      companies: {
        Row: {
          archived: boolean;
          budget_per_year: number | null;
          contact_email: string | null;
          contact_name: string | null;
          created_at: string;
          employee_count: number | null;
          follow_up_at: string | null;
          id: string;
          industry: string;
          last_touch_at: string | null;
          name: string;
          next_touch_at: string | null;
          notes: string;
          office_requirements: string;
          outreach_status: Database["public"]["Enums"]["outreach_status"];
          preferred_areas: string;
          size_sqm_max: number | null;
          size_sqm_min: number | null;
          stage: Database["public"]["Enums"]["deal_stage"];
          target_move_date: string | null;
          target_rent_per_sqm: number | null;
          touch_count: number;
          updated_at: string;
          website: string;
        };
        Insert: {
          archived?: boolean;
          budget_per_year?: number | null;
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          employee_count?: number | null;
          follow_up_at?: string | null;
          id?: string;
          industry?: string;
          last_touch_at?: string | null;
          name: string;
          next_touch_at?: string | null;
          notes?: string;
          office_requirements?: string;
          outreach_status?: Database["public"]["Enums"]["outreach_status"];
          preferred_areas?: string;
          size_sqm_max?: number | null;
          size_sqm_min?: number | null;
          stage?: Database["public"]["Enums"]["deal_stage"];
          target_move_date?: string | null;
          target_rent_per_sqm?: number | null;
          touch_count?: number;
          updated_at?: string;
          website?: string;
        };
        Update: {
          archived?: boolean;
          budget_per_year?: number | null;
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          employee_count?: number | null;
          follow_up_at?: string | null;
          id?: string;
          industry?: string;
          last_touch_at?: string | null;
          name?: string;
          next_touch_at?: string | null;
          notes?: string;
          office_requirements?: string;
          outreach_status?: Database["public"]["Enums"]["outreach_status"];
          preferred_areas?: string;
          size_sqm_max?: number | null;
          size_sqm_min?: number | null;
          stage?: Database["public"]["Enums"]["deal_stage"];
          target_move_date?: string | null;
          target_rent_per_sqm?: number | null;
          touch_count?: number;
          updated_at?: string;
          website?: string;
        };
        Relationships: [];
      };
      touches: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          note: string;
          outcome: Database["public"]["Enums"]["touch_outcome"];
          touch_number: number;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          note?: string;
          outcome: Database["public"]["Enums"]["touch_outcome"];
          touch_number: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          note?: string;
          outcome?: Database["public"]["Enums"]["touch_outcome"];
          touch_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "touches_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      log_entries: {
        Row: {
          body: string;
          company_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          body: string;
          company_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          body?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "log_entries_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      deal_stage: "targeting" | "searching" | "viewing" | "negotiating" | "closed";
      outreach_status: "active" | "responded" | "parked" | "dead";
      touch_outcome: "no_answer" | "not_now" | "not_interested" | "responded" | "meeting_booked";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      deal_stage: ["targeting", "searching", "viewing", "negotiating", "closed"],
      outreach_status: ["active", "responded", "parked", "dead"],
      touch_outcome: ["no_answer", "not_now", "not_interested", "responded", "meeting_booked"],
    },
  },
} as const;
