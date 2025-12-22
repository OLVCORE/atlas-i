-- MC2: Core Financeiro - Entities, Accounts, Ledger
-- Migration idempotente para criação do schema financeiro básico

-- ========================================
-- ENTITIES (PF + PJ)
-- ========================================
CREATE TABLE IF NOT EXISTS public.entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('PF', 'PJ')),
    legal_name text NOT NULL,
    document text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para entities
CREATE INDEX IF NOT EXISTS idx_entities_workspace_id ON public.entities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(type);

-- ========================================
-- ACCOUNTS (Contas Financeiras)
-- ========================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('checking', 'investment', 'other')),
    currency text NOT NULL DEFAULT 'BRL',
    opening_balance numeric(15,2) NOT NULL DEFAULT 0,
    opening_balance_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_workspace_id ON public.accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_accounts_entity_id ON public.accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(type);

-- ========================================
-- LEDGER (TRANSACTIONS)
-- ========================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount numeric(15,2) NOT NULL,
    currency text NOT NULL DEFAULT 'BRL',
    date date NOT NULL,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para transactions
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id ON public.transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_entity_id ON public.transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - ENTITIES
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "entities_select_for_members" ON public.entities;
CREATE POLICY "entities_select_for_members"
    ON public.entities
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DROP POLICY IF EXISTS "entities_insert_for_members" ON public.entities;
CREATE POLICY "entities_insert_for_members"
    ON public.entities
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- UPDATE: Apenas membros do workspace
DROP POLICY IF EXISTS "entities_update_for_members" ON public.entities;
CREATE POLICY "entities_update_for_members"
    ON public.entities
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "entities_delete_for_members" ON public.entities;
CREATE POLICY "entities_delete_for_members"
    ON public.entities
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - ACCOUNTS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "accounts_select_for_members" ON public.accounts;
CREATE POLICY "accounts_select_for_members"
    ON public.accounts
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity do mesmo workspace
DROP POLICY IF EXISTS "accounts_insert_for_members" ON public.accounts;
CREATE POLICY "accounts_insert_for_members"
    ON public.accounts
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND entity_id IN (
            SELECT id
            FROM public.entities
            WHERE workspace_id = accounts.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DROP POLICY IF EXISTS "accounts_update_for_members" ON public.accounts;
CREATE POLICY "accounts_update_for_members"
    ON public.accounts
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "accounts_delete_for_members" ON public.accounts;
CREATE POLICY "accounts_delete_for_members"
    ON public.accounts
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - TRANSACTIONS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "transactions_select_for_members" ON public.transactions;
CREATE POLICY "transactions_select_for_members"
    ON public.transactions
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity/account do mesmo workspace
DROP POLICY IF EXISTS "transactions_insert_for_members" ON public.transactions;
CREATE POLICY "transactions_insert_for_members"
    ON public.transactions
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND entity_id IN (
            SELECT id
            FROM public.entities
            WHERE workspace_id = transactions.workspace_id
        )
        AND (
            account_id IS NULL
            OR account_id IN (
                SELECT id
                FROM public.accounts
                WHERE workspace_id = transactions.workspace_id
            )
        )
    );

-- UPDATE: Apenas membros do workspace
DROP POLICY IF EXISTS "transactions_update_for_members" ON public.transactions;
CREATE POLICY "transactions_update_for_members"
    ON public.transactions
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "transactions_delete_for_members" ON public.transactions;
CREATE POLICY "transactions_delete_for_members"
    ON public.transactions
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

