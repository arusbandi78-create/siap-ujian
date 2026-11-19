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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          attempt_id: string
          flagged: boolean
          is_correct: boolean | null
          points_awarded: number | null
          question_id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          attempt_id: string
          flagged?: boolean
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          attempt_id?: string
          flagged?: boolean
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          created_at: string
          deadline_at: string | null
          exam_id: string
          id: string
          last_seen_at: string | null
          question_order: Json
          resume_allowed: boolean
          resume_version: number
          score: number | null
          started_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          token_hash: string | null
          violation_count: number
        }
        Insert: {
          created_at?: string
          deadline_at?: string | null
          exam_id: string
          id?: string
          last_seen_at?: string | null
          question_order?: Json
          resume_allowed?: boolean
          resume_version?: number
          score?: number | null
          started_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          token_hash?: string | null
          violation_count?: number
        }
        Update: {
          created_at?: string
          deadline_at?: string | null
          exam_id?: string
          id?: string
          last_seen_at?: string | null
          question_order?: Json
          resume_allowed?: boolean
          resume_version?: number
          score?: number | null
          started_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          token_hash?: string | null
          violation_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          exam_id: string
          position: number
          question_id: string
        }
        Insert: {
          exam_id: string
          position?: number
          question_id: string
        }
        Update: {
          exam_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          code: string
          created_at: string
          duration_minutes: number
          end_at: string
          id: string
          instructions: string
          is_active: boolean
          kkm: number
          max_violations: number
          question_count: number | null
          require_fullscreen: boolean
          show_results: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          start_at: string
          subject: string
          teacher_id: string
          title: string
          violation_action: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_minutes?: number
          end_at?: string
          id?: string
          instructions?: string
          is_active?: boolean
          kkm?: number
          max_violations?: number
          question_count?: number | null
          require_fullscreen?: boolean
          show_results?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_at?: string
          subject?: string
          teacher_id: string
          title: string
          violation_action?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_minutes?: number
          end_at?: string
          id?: string
          instructions?: string
          is_active?: boolean
          kkm?: number
          max_violations?: number
          question_count?: number | null
          require_fullscreen?: boolean
          show_results?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_at?: string
          subject?: string
          teacher_id?: string
          title?: string
          violation_action?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          school: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          school?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          school?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer: Json | null
          created_at: string
          id: string
          media: Json | null
          option_media: Json
          options: Json
          points: number
          prompt: string
          subject: string
          teacher_id: string
          topic: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          answer?: Json | null
          created_at?: string
          id?: string
          media?: Json | null
          option_media?: Json
          options?: Json
          points?: number
          prompt: string
          subject?: string
          teacher_id: string
          topic?: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          answer?: Json | null
          created_at?: string
          id?: string
          media?: Json | null
          option_media?: Json
          options?: Json
          points?: number
          prompt?: string
          subject?: string
          teacher_id?: string
          topic?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: []
      }
      students: {
        Row: {
          class_name: string
          created_at: string
          full_name: string
          id: string
          pin_hash: string
          teacher_id: string
          username: string
        }
        Insert: {
          class_name?: string
          created_at?: string
          full_name: string
          id?: string
          pin_hash: string
          teacher_id: string
          username: string
        }
        Update: {
          class_name?: string
          created_at?: string
          full_name?: string
          id?: string
          pin_hash?: string
          teacher_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      violations: {
        Row: {
          attempt_id: string
          exam_id: string
          id: string
          note: string
          occurred_at: string
          type: string
        }
        Insert: {
          attempt_id: string
          exam_id: string
          id?: string
          note?: string
          occurred_at?: string
          type: string
        }
        Update: {
          attempt_id?: string
          exam_id?: string
          id?: string
          note?: string
          occurred_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_student: {
        Args: {
          _class: string
          _full_name: string
          _username: string
        }
        Returns: string
      }
      grade_attempt: { Args: { _attempt: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lock_exam_exit: {
        Args: { _hash: string; _type: string; _version: number }
        Returns: undefined
      }
      reset_student_pin: {
        Args: { _id: string; _pin: string }
        Returns: undefined
      }
      valid_question_media: {
        Args: { m: Json; owner_id: string }
        Returns: boolean
      }
      verify_student_login: {
        Args: { _code: string; _full_name: string }
        Returns: {
          exam_id: string
          student_id: string
        }[]
      }
    }
    Enums: {
      app_role: "teacher"
      question_type: "pg" | "isian" | "bs" | "uraian"
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
      app_role: ["teacher"],
      question_type: ["pg", "isian", "bs", "uraian"],
    },
  },
} as const
