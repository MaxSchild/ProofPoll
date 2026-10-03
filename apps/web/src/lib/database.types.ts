export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      poll_attention_checks: {
        Row: {
          correct_option: string;
          poll_id: string;
          question_id: string;
        };
        Insert: {
          correct_option: string;
          poll_id: string;
          question_id: string;
        };
        Update: {
          correct_option?: string;
          poll_id?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poll_attention_checks_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: true;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
        ];
      };
      polls: {
        Row: {
          authors: NonNullable<Json>;
          closed_at: string | null;
          created_at: string;
          description: string;
          exclusion_rules: NonNullable<Json>;
          id: string;
          opened_at: string | null;
          owner_id: string;
          planned_n: number | null;
          questions: NonNullable<Json>;
          status: Database["public"]["Enums"]["poll_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          authors?: NonNullable<Json>;
          closed_at?: string | null;
          created_at?: string;
          description?: string;
          exclusion_rules?: NonNullable<Json>;
          id?: string;
          opened_at?: string | null;
          owner_id?: string;
          planned_n?: number | null;
          questions: NonNullable<Json>;
          status?: Database["public"]["Enums"]["poll_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          authors?: NonNullable<Json>;
          closed_at?: string | null;
          created_at?: string;
          description?: string;
          exclusion_rules?: NonNullable<Json>;
          id?: string;
          opened_at?: string | null;
          owner_id?: string;
          planned_n?: number | null;
          questions?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["poll_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      responses: {
        Row: {
          answers: NonNullable<Json>;
          created_at: string;
          id: string;
          poll_id: string;
          seq: number;
        };
        Insert: {
          answers: NonNullable<Json>;
          created_at?: string;
          id?: string;
          poll_id: string;
          seq: number;
        };
        Update: {
          answers?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          poll_id?: string;
          seq?: number;
        };
        Relationships: [
          {
            foreignKeyName: "responses_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      poll_response_count: { Args: { p_poll_id: string }; Returns: number };
      save_poll: { Args: { p_check: Json; p_id: string; p_poll: Json }; Returns: string };
      submit_response: {
        Args: { p_answers: Json; p_poll_id: string };
        Returns: {
          created_at: string;
          id: string;
          seq: number;
        }[];
      };
      validate_poll_questions: { Args: { p_questions: Json }; Returns: undefined };
    };
    Enums: {
      poll_status: "draft" | "open" | "closed";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      poll_status: ["draft", "open", "closed"],
    },
  },
} as const;
