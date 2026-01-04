/**
 * Supabase データベース型定義
 * 既存DBテーブル構造に対応
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ユーザーロール
export type UserRole = "user" | "admin";

// 注文ステータス
export type OrderStatus = "ordered" | "canceled" | "invalid";

// 自動注文実行ステータス
export type AutoOrderRunStatus = "running" | "completed" | "failed";

export interface Database {
  public: {
    Tables: {
      // ユーザープロフィール（既存テーブル名: profiles）
      profiles: {
        Row: {
          id: string;
          employee_code: string;
          full_name: string;
          email: string | null;
          role: UserRole;
          is_active: boolean;
          joined_date: string | null;
          left_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          employee_code: string;
          full_name: string;
          email?: string | null;
          role?: UserRole;
          is_active?: boolean;
          joined_date?: string | null;
          left_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_code?: string;
          full_name?: string;
          email?: string | null;
          role?: UserRole;
          is_active?: boolean;
          joined_date?: string | null;
          left_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // 業者マスタ
      vendors: {
        Row: {
          id: number;
          code: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          code: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          code?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      // メニューマスタ（既存テーブル名: menu_items）
      menu_items: {
        Row: {
          id: number;
          vendor_id: number;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          vendor_id: number;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          vendor_id?: number;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      // メニュー価格
      menu_prices: {
        Row: {
          id: number;
          menu_id: number;
          price: number;
          start_date: string;
          end_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          menu_id: number;
          price: number;
          start_date: string;
          end_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          menu_id?: number;
          price?: number;
          start_date?: string;
          end_date?: string | null;
          created_at?: string;
        };
      };
      // 注文可能日カレンダー（既存テーブル名: order_calendar）
      order_calendar: {
        Row: {
          target_date: string;
          is_available: boolean;
          deadline_time: string | null;
          note: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Insert: {
          target_date: string;
          is_available?: boolean;
          deadline_time?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          target_date?: string;
          is_available?: boolean;
          deadline_time?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // 日別締切時刻
      order_deadlines: {
        Row: {
          date: string;
          cutoff_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          date: string;
          cutoff_time: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          cutoff_time?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      // 注文
      orders: {
        Row: {
          id: number;
          user_id: string;
          menu_item_id: number;
          menu_price_id: number;
          order_date: string;
          quantity: number;
          unit_price_snapshot: number;
          status: OrderStatus;
          source: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          menu_item_id: number;
          menu_price_id: number;
          order_date: string;
          quantity?: number;
          unit_price_snapshot: number;
          status?: OrderStatus;
          source: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          menu_item_id?: number;
          menu_price_id?: number;
          order_date?: string;
          quantity?: number;
          unit_price_snapshot?: number;
          status?: OrderStatus;
          source?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      // 締日期間
      closing_periods: {
        Row: {
          id: number;
          start_date: string;
          end_date: string;
          closing_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          start_date: string;
          end_date: string;
          closing_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          start_date?: string;
          end_date?: string;
          closing_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      // 操作ログ（既存テーブル名: audit_logs）
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_table: string | null;
          target_id: string | null;
          details: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          target_table?: string | null;
          target_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
      // 自動注文設定（既存テーブル名: auto_order_configs）
      auto_order_configs: {
        Row: {
          user_id: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      // 自動注文テンプレート
      auto_order_templates: {
        Row: {
          id: number;
          user_id: string;
          menu_id: number;
          quantity: number;
          day_of_week: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          menu_id: number;
          quantity?: number;
          day_of_week?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          menu_id?: number;
          quantity?: number;
          day_of_week?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // 自動注文実行履歴
      auto_order_runs: {
        Row: {
          id: number;
          run_date: string;
          executed_at: string | null;
          status: string | null;
          log_details: Json | null;
        };
        Insert: {
          id?: number;
          run_date: string;
          executed_at?: string | null;
          status?: string | null;
          log_details?: Json | null;
        };
        Update: {
          id?: number;
          run_date?: string;
          executed_at?: string | null;
          status?: string | null;
          log_details?: Json | null;
        };
      };
      // 自動注文実行アイテム
      auto_order_run_items: {
        Row: {
          id: number;
          run_id: number;
          user_id: string;
          target_date: string;
          result: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          run_id: number;
          user_id: string;
          target_date: string;
          result: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          run_id?: number;
          user_id?: string;
          target_date?: string;
          result?: string;
          detail?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      auto_order_run_status: AutoOrderRunStatus;
    };
  };
}

// ヘルパー型
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
