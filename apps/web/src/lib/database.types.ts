export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      answer_records: {
        Row: {
          created_at: string;
          leaf_hash: string;
          poll_id: string;
          recorded_at: string | null;
          response_id: string;
          salt: string | null;
          seq: number;
          status: Database["public"]["Enums"]["record_status"];
          tx: string | null;
        };
        Insert: {
          created_at?: string;
          leaf_hash: string;
          poll_id: string;
          recorded_at?: string | null;
          response_id: string;
          salt?: string | null;
          seq: number;
          status?: Database["public"]["Enums"]["record_status"];
          tx?: string | null;
        };
        Update: {
          created_at?: string;
          leaf_hash?: string;
          poll_id?: string;
          recorded_at?: string | null;
          response_id?: string;
          salt?: string | null;
          seq?: number;
          status?: Database["public"]["Enums"]["record_status"];
          tx?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "answer_records_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answer_records_response_id_fkey";
            columns: ["response_id"];
            isOneToOne: true;
            referencedRelation: "responses";
            referencedColumns: ["id"];
          },
        ];
      };
      doi_matches: {
        Row: {
          confirm_by: string;
          doi: string;
          id: string;
          matched_at: string;
          matched_title: string;
          paper_id: string;
          reason: string;
          source: string;
          status: string;
        };
        Insert: {
          confirm_by?: string;
          doi: string;
          id?: string;
          matched_at?: string;
          matched_title: string;
          paper_id: string;
          reason: string;
          source: string;
          status?: string;
        };
        Update: {
          confirm_by?: string;
          doi?: string;
          id?: string;
          matched_at?: string;
          matched_title?: string;
          paper_id?: string;
          reason?: string;
          source?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "doi_matches_paper_id_fkey";
            columns: ["paper_id"];
            isOneToOne: false;
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };
      paper_versions: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          id: string;
          manuscript_name: string;
          manuscript_sha256: string;
          paper_id: string;
          review_token: string;
          version: number;
        };
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          manuscript_name: string;
          manuscript_sha256: string;
          paper_id: string;
          review_token?: string;
          version: number;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          manuscript_name?: string;
          manuscript_sha256?: string;
          paper_id?: string;
          review_token?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "paper_versions_paper_id_fkey";
            columns: ["paper_id"];
            isOneToOne: false;
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };
      papers: {
        Row: {
          authors: NonNullable<Json>;
          auto_matched: boolean;
          created_at: string;
          doi: string | null;
          id: string;
          owner_id: string;
          published_at: string | null;
          results_public: boolean;
          status: Database["public"]["Enums"]["paper_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          authors?: NonNullable<Json>;
          auto_matched?: boolean;
          created_at?: string;
          doi?: string | null;
          id?: string;
          owner_id?: string;
          published_at?: string | null;
          results_public?: boolean;
          status?: Database["public"]["Enums"]["paper_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          authors?: NonNullable<Json>;
          auto_matched?: boolean;
          created_at?: string;
          doi?: string | null;
          id?: string;
          owner_id?: string;
          published_at?: string | null;
          results_public?: boolean;
          status?: Database["public"]["Enums"]["paper_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
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
      poll_records: {
        Row: {
          created_at: string;
          plan_hash: string;
          plan_tx: string | null;
          poll_id: string;
          record_pubkey: string;
          record_secret: string;
          recorded_at: string | null;
          status: Database["public"]["Enums"]["record_status"];
        };
        Insert: {
          created_at?: string;
          plan_hash: string;
          plan_tx?: string | null;
          poll_id: string;
          record_pubkey: string;
          record_secret: string;
          recorded_at?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
        };
        Update: {
          created_at?: string;
          plan_hash?: string;
          plan_tx?: string | null;
          poll_id?: string;
          record_pubkey?: string;
          record_secret?: string;
          recorded_at?: string | null;
          status?: Database["public"]["Enums"]["record_status"];
        };
        Relationships: [
          {
            foreignKeyName: "poll_records_poll_id_fkey";
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
          paper_id: string | null;
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
          paper_id?: string | null;
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
          paper_id?: string | null;
          planned_n?: number | null;
          questions?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["poll_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "polls_paper_id_fkey";
            columns: ["paper_id"];
            isOneToOne: false;
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };
      responses: {
        Row: {
          answers: NonNullable<Json>;
          client_id: string | null;
          created_at: string;
          id: string;
          poll_id: string;
          seq: number;
        };
        Insert: {
          answers: NonNullable<Json>;
          client_id?: string | null;
          created_at?: string;
          id?: string;
          poll_id: string;
          seq: number;
        };
        Update: {
          answers?: NonNullable<Json>;
          client_id?: string | null;
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
      validation_results: {
        Row: {
          created_at: string;
          details: NonNullable<Json>;
          levels_run: string[];
          poll_id: string;
          verdict: string;
          version_id: string;
        };
        Insert: {
          created_at?: string;
          details: NonNullable<Json>;
          levels_run: string[];
          poll_id: string;
          verdict: string;
          version_id: string;
        };
        Update: {
          created_at?: string;
          details?: NonNullable<Json>;
          levels_run?: string[];
          poll_id?: string;
          verdict?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_results_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_results_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "paper_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      version_study_numbers: {
        Row: {
          extracted: NonNullable<Json>;
          poll_id: string;
          reported_exclusions: number | null;
          reported_n: number | null;
          reported_results: NonNullable<Json>;
          version_id: string;
        };
        Insert: {
          extracted?: NonNullable<Json>;
          poll_id: string;
          reported_exclusions?: number | null;
          reported_n?: number | null;
          reported_results?: NonNullable<Json>;
          version_id: string;
        };
        Update: {
          extracted?: NonNullable<Json>;
          poll_id?: string;
          reported_exclusions?: number | null;
          reported_n?: number | null;
          reported_results?: NonNullable<Json>;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "version_study_numbers_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "version_study_numbers_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "paper_versions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirm_paper_version: {
        Args: { p_numbers: Json; p_version_id: string };
        Returns: undefined;
      };
      create_paper_version: {
        Args: { p_extracted: Json; p_name: string; p_paper_id: string; p_sha256: string };
        Returns: string;
      };
      discard_paper_version: { Args: { p_version_id: string }; Returns: undefined };
      expire_doi_match_now: { Args: { p_match_id: string }; Returns: undefined };
      get_answer_records: {
        Args: { p_poll_id: string };
        Returns: {
          answered_at: string;
          leaf_hash: string;
          recorded_at: string;
          response_id: string;
          seq: number;
          status: Database["public"]["Enums"]["record_status"];
          tx: string;
        }[];
      };
      get_poll_record: {
        Args: { p_poll_id: string };
        Returns: {
          answer_count: number;
          closed_at: string;
          description: string;
          exclusion_rules: Json;
          opened_at: string;
          plan_hash: string;
          plan_recorded_at: string;
          plan_status: Database["public"]["Enums"]["record_status"];
          plan_tx: string;
          planned_n: number;
          poll_id: string;
          questions: Json;
          record_pubkey: string;
          status: Database["public"]["Enums"]["poll_status"];
          title: string;
        }[];
      };
      get_public_poll: {
        Args: { p_id: string };
        Returns: {
          description: string;
          id: string;
          questions: Json;
          status: Database["public"]["Enums"]["poll_status"];
          title: string;
        }[];
      };
      get_published_paper: { Args: { p_id: string }; Returns: Json };
      get_review_version: { Args: { p_token: string }; Returns: Json };
      is_api_request: { Args: Record<PropertyKey, never>; Returns: boolean };
      own_paper: {
        Args: { p_paper_id: string };
        Returns: {
          authors: NonNullable<Json>;
          auto_matched: boolean;
          created_at: string;
          doi: string | null;
          id: string;
          owner_id: string;
          published_at: string | null;
          results_public: boolean;
          status: Database["public"]["Enums"]["paper_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "papers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      poll_response_count: { Args: { p_poll_id: string }; Returns: number };
      publish_expired_doi_matches: { Args: Record<PropertyKey, never>; Returns: number };
      record_doi_match: {
        Args: {
          p_doi: string;
          p_paper_id: string;
          p_reason: string;
          p_source: string;
          p_title: string;
        };
        Returns: string;
      };
      respond_to_doi_match: {
        Args: { p_confirm: boolean; p_match_id: string };
        Returns: undefined;
      };
      save_paper: { Args: { p_id: string; p_paper: Json; p_poll_ids: string[] }; Returns: string };
      save_poll: { Args: { p_check: Json; p_id: string; p_poll: Json }; Returns: string };
      search_published_papers: {
        Args: { p_dois: string[]; p_ids: string[]; p_terms: string[] };
        Returns: {
          authors: Json;
          doi: string;
          id: string;
          published_at: string;
          score: number;
          title: string;
        }[];
      };
      study_summary: {
        Args: { p_poll_id: string; p_version_id: string; p_with_results: boolean };
        Returns: Json;
      };
      submit_response: {
        Args: { p_answers: Json; p_client_id?: string; p_poll_id: string };
        Returns: {
          created_at: string;
          id: string;
          seq: number;
        }[];
      };
      validate_poll_questions: { Args: { p_questions: Json }; Returns: undefined };
      validate_study: {
        Args: {
          p_poll_id: string;
          p_reported_exclusions: number;
          p_reported_n: number;
          p_reported_results: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      paper_status: "draft" | "in_review" | "published";
      poll_status: "draft" | "open" | "closed";
      record_status: "pending" | "recorded" | "failed";
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
      paper_status: ["draft", "in_review", "published"],
      poll_status: ["draft", "open", "closed"],
      record_status: ["pending", "recorded", "failed"],
    },
  },
} as const;
