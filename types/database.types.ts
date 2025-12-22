export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string
          created_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'finance_manager' | 'viewer' | 'accountant'
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'finance_manager' | 'viewer' | 'accountant'
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'finance_manager' | 'viewer' | 'accountant'
          created_at?: string
        }
      }
      entities: {
        Row: {
          id: string
          workspace_id: string
          type: 'PF' | 'PJ'
          legal_name: string
          document: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          type: 'PF' | 'PJ'
          legal_name: string
          document: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          type?: 'PF' | 'PJ'
          legal_name?: string
          document?: string
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          workspace_id: string
          entity_id: string
          name: string
          type: 'checking' | 'investment' | 'other'
          currency: string
          opening_balance: number
          opening_balance_date: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          entity_id: string
          name: string
          type: 'checking' | 'investment' | 'other'
          currency?: string
          opening_balance?: number
          opening_balance_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          entity_id?: string
          name?: string
          type?: 'checking' | 'investment' | 'other'
          currency?: string
          opening_balance?: number
          opening_balance_date?: string
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          workspace_id: string
          entity_id: string
          account_id: string | null
          type: 'income' | 'expense' | 'transfer'
          amount: number
          currency: string
          date: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          entity_id: string
          account_id?: string | null
          type: 'income' | 'expense' | 'transfer'
          amount: number
          currency?: string
          date: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          entity_id?: string
          account_id?: string | null
          type?: 'income' | 'expense' | 'transfer'
          amount?: number
          currency?: string
          date?: string
          description?: string
          created_at?: string
        }
      }
    }
  }
}

