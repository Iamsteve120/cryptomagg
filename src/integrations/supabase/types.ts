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
      b2c_callback_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          originator_conversation_id: string | null
          result_code: number | null
          result_desc: string | null
          transaction_receipt: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          originator_conversation_id?: string | null
          result_code?: number | null
          result_desc?: string | null
          transaction_receipt?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          originator_conversation_id?: string | null
          result_code?: number | null
          result_desc?: string | null
          transaction_receipt?: string | null
        }
        Relationships: []
      }
      crypto_deposits: {
        Row: {
          address: string
          amount_usdt: number
          created_at: string
          failure_reason: string | null
          id: string
          network: string
          status: string
          tx_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          amount_usdt: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          network?: string
          status?: string
          tx_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          amount_usdt?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          network?: string
          status?: string
          tx_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_withdrawals: {
        Row: {
          amount_usdt: number
          asset: string
          created_at: string
          destination_address: string
          failure_reason: string | null
          id: string
          network: string
          provider: string
          provider_payout_id: string | null
          status: string
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usdt: number
          asset: string
          created_at?: string
          destination_address: string
          failure_reason?: string | null
          id?: string
          network: string
          provider?: string
          provider_payout_id?: string | null
          status?: string
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usdt?: number
          asset?: string
          created_at?: string
          destination_address?: string
          failure_reason?: string | null
          id?: string
          network?: string
          provider?: string
          provider_payout_id?: string | null
          status?: string
          transaction_id?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_withdrawals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_intents: {
        Row: {
          amount_kes: number
          amount_usdt: number
          created_at: string
          failure_reason: string | null
          id: string
          phone: string
          provider: string
          provider_checkout_id: string | null
          provider_receipt: string | null
          status: string
          updated_at: string
          usd_kes_rate: number
          user_id: string
        }
        Insert: {
          amount_kes: number
          amount_usdt: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          phone: string
          provider?: string
          provider_checkout_id?: string | null
          provider_receipt?: string | null
          status?: string
          updated_at?: string
          usd_kes_rate: number
          user_id: string
        }
        Update: {
          amount_kes?: number
          amount_usdt?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          phone?: string
          provider?: string
          provider_checkout_id?: string | null
          provider_receipt?: string | null
          status?: string
          updated_at?: string
          usd_kes_rate?: number
          user_id?: string
        }
        Relationships: []
      }
      login_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_flags: {
        Row: {
          code: string | null
          detail: string | null
          enabled: boolean
          flag: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          detail?: string | null
          enabled?: boolean
          flag: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          detail?: string | null
          enabled?: boolean
          flag?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_confirmed: boolean
          client_id: string | null
          country: string | null
          created_at: string
          demo_balance: number
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          kyc_approved_at: string | null
          kyc_doc_back_path: string | null
          kyc_doc_front_path: string | null
          kyc_doc_path: string | null
          kyc_doc_type: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          last_name: string | null
          last_seen_at: string | null
          live_balance: number
          phone: string | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          age_confirmed?: boolean
          client_id?: string | null
          country?: string | null
          created_at?: string
          demo_balance?: number
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          kyc_approved_at?: string | null
          kyc_doc_back_path?: string | null
          kyc_doc_front_path?: string | null
          kyc_doc_path?: string | null
          kyc_doc_type?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          live_balance?: number
          phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          age_confirmed?: boolean
          client_id?: string | null
          country?: string | null
          created_at?: string
          demo_balance?: number
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          kyc_approved_at?: string | null
          kyc_doc_back_path?: string | null
          kyc_doc_front_path?: string | null
          kyc_doc_path?: string | null
          kyc_doc_type?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          live_balance?: number
          phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }
        Insert: {
          account_mode?: string
          asset_name: string
          balance_after_open?: number | null
          balance_after_settlement?: number | null
          balance_before?: number | null
          created_at?: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price?: number | null
          expires_at: string
          id?: string
          payout_rate: number
          pnl?: number
          settled_at?: string | null
          stake: number
          status?: string
          stop_loss_amount?: number | null
          stop_loss_percent?: number | null
          stop_loss_price?: number | null
          symbol: string
          take_profit_amount?: number | null
          take_profit_percent?: number | null
          take_profit_price?: number | null
          trade_source?: string
          user_id: string
        }
        Update: {
          account_mode?: string
          asset_name?: string
          balance_after_open?: number | null
          balance_after_settlement?: number | null
          balance_before?: number | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          entry_price?: number
          exit_price?: number | null
          expires_at?: string
          id?: string
          payout_rate?: number
          pnl?: number
          settled_at?: string | null
          stake?: number
          status?: string
          stop_loss_amount?: number | null
          stop_loss_percent?: number | null
          stop_loss_price?: number | null
          symbol?: string
          take_profit_amount?: number | null
          take_profit_percent?: number | null
          take_profit_price?: number | null
          trade_source?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_mode: string
          amount: number
          asset: string
          created_at: string
          destination: string | null
          id: string
          kind: string
          method: string
          status: string
          user_id: string
        }
        Insert: {
          account_mode?: string
          amount: number
          asset?: string
          created_at?: string
          destination?: string | null
          id?: string
          kind: string
          method: string
          status?: string
          user_id: string
        }
        Update: {
          account_mode?: string
          amount?: number
          asset?: string
          created_at?: string
          destination?: string | null
          id?: string
          kind?: string
          method?: string
          status?: string
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
      withdrawal_otps: {
        Row: {
          amount_usdt: number
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          amount_usdt: number
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          amount_usdt?: number
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_usdt: number
          created_at: string
          failure_reason: string | null
          id: string
          originator_conversation_id: string | null
          phone: string
          provider_conversation_id: string | null
          provider_receipt: string | null
          receiver_name: string | null
          result_code: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_usdt: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          originator_conversation_id?: string | null
          phone: string
          provider_conversation_id?: string | null
          provider_receipt?: string | null
          receiver_name?: string | null
          result_code?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_usdt?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          originator_conversation_id?: string | null
          phone?: string
          provider_conversation_id?: string | null
          provider_receipt?: string | null
          receiver_name?: string | null
          result_code?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_mpesa_withdrawal: {
        Args: { p_conversation_id: string; p_request_id: string }
        Returns: boolean
      }
      close_demo_trade_at_live_pnl: {
        Args: { p_exit_price: number; p_trade_id: string; p_user_id: string }
        Returns: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      credit_confirmed_deposit: {
        Args: { p_intent_id: string; p_receipt: string }
        Returns: number
      }
      credit_crypto_deposit: {
        Args: {
          p_address: string
          p_amount: number
          p_network: string
          p_tx_hash: string
          p_user_id: string
        }
        Returns: number
      }
      finalize_b2c_withdrawal: {
        Args: {
          p_conversation_id: string
          p_originator_conversation_id: string
          p_receipt?: string
          p_receiver_name?: string
          p_result_code?: number
          p_result_desc?: string
          p_success: boolean
        }
        Returns: {
          amount_usdt: number
          final_status: string
          phone: string
          request_id: string
          user_id: string
        }[]
      }
      finalize_crypto_withdrawal: {
        Args: {
          p_failure_reason?: string
          p_provider_id: string
          p_request_id: string
          p_success: boolean
          p_tx_hash?: string
        }
        Returns: boolean
      }
      finalize_mpesa_withdrawal: {
        Args: {
          p_conversation_id: string
          p_failure_reason?: string
          p_receipt?: string
          p_success: boolean
        }
        Returns: {
          amount_usdt: number
          final_status: string
          phone: string
          request_id: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hold_crypto_withdrawal: {
        Args: {
          p_address: string
          p_amount: number
          p_asset: string
          p_network: string
          p_user_id: string
        }
        Returns: {
          amount_usdt: number
          asset: string
          created_at: string
          destination_address: string
          failure_reason: string | null
          id: string
          network: string
          provider: string
          provider_payout_id: string | null
          status: string
          transaction_id: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "crypto_withdrawals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hold_withdrawal_amount: {
        Args: { p_amount: number; p_phone: string; p_user_id: string }
        Returns: {
          amount_usdt: number
          created_at: string
          failure_reason: string | null
          id: string
          originator_conversation_id: string | null
          phone: string
          provider_conversation_id: string | null
          provider_receipt: string | null
          receiver_name: string | null
          result_code: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hold_withdrawal_for_payout: {
        Args: {
          p_amount: number
          p_originator_conversation_id: string
          p_phone: string
          p_user_id: string
        }
        Returns: {
          amount_usdt: number
          created_at: string
          failure_reason: string | null
          id: string
          originator_conversation_id: string | null
          phone: string
          provider_conversation_id: string | null
          provider_receipt: string | null
          receiver_name: string | null
          result_code: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      next_client_id: { Args: never; Returns: string }
      refund_pending_withdrawal: {
        Args: { p_failure_reason: string; p_request_id: string }
        Returns: boolean
      }
      reserve_demo_trade: {
        Args: {
          p_asset_name: string
          p_direction: string
          p_duration_seconds: number
          p_entry_price: number
          p_expires_at: string
          p_payout_rate: number
          p_stake: number
          p_symbol: string
          p_trade_source: string
          p_user_id: string
        }
        Returns: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_demo_trade_with_risk: {
        Args: {
          p_asset_name: string
          p_direction: string
          p_duration_seconds: number
          p_entry_price: number
          p_expires_at: string
          p_payout_rate: number
          p_stake: number
          p_stop_loss_percent: number
          p_symbol: string
          p_take_profit_percent: number
          p_trade_source: string
          p_user_id: string
        }
        Returns: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_live_trade: {
        Args: {
          p_asset_name: string
          p_direction: string
          p_duration_seconds: number
          p_entry_price: number
          p_expires_at: string
          p_payout_rate: number
          p_stake: number
          p_symbol: string
          p_user_id: string
        }
        Returns: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      settle_demo_trade: {
        Args: { p_exit_price: number; p_trade_id: string; p_user_id: string }
        Returns: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      settle_live_trade_at_market: {
        Args: { p_exit_price: number; p_trade_id: string; p_user_id: string }
        Returns: {
          account_mode: string
          asset_name: string
          balance_after_open: number | null
          balance_after_settlement: number | null
          balance_before: number | null
          created_at: string
          direction: string
          duration_seconds: number
          entry_price: number
          exit_price: number | null
          expires_at: string
          id: string
          payout_rate: number
          pnl: number
          settled_at: string | null
          stake: number
          status: string
          stop_loss_amount: number | null
          stop_loss_percent: number | null
          stop_loss_price: number | null
          symbol: string
          take_profit_amount: number | null
          take_profit_percent: number | null
          take_profit_price: number | null
          trade_source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trades"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
