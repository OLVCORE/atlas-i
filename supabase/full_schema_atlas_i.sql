-- =============================================================================
-- ATLAS-i - Schema completo para Supabase (copiar e colar no SQL Editor)
-- =============================================================================
-- 1. Crie um novo projeto em https://supabase.com/dashboard
-- 2. No projeto: SQL Editor > New query
-- 3. Cole TODO este arquivo e clique em Run (ou Ctrl+Enter)
-- 4. Aguarde a execução. Ao final você terá todas as tabelas, RLS e triggers.
-- 5. No app: configure .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
-- =============================================================================

-- ========== 20251220_000001_mc1_workspaces.sql ==========
-- MC1: Workspaces + Workspace Members + RLS
-- Migration idempotente para criação do schema multi-tenant básico

-- Tabela: workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela: workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'finance_manager', 'viewer', 'accountant')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);

-- Habilitar RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Policies para workspaces
-- SELECT: criador vê o próprio workspace OU usuário é membro (evita recursão com workspace_members)
DROP POLICY IF EXISTS "workspaces_select_for_members" ON public.workspaces;
CREATE POLICY "workspaces_select_for_members"
    ON public.workspaces
    FOR SELECT
    USING (
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
        )
    );

-- INSERT: permitido para usuário autenticado se created_by = auth.uid()
DROP POLICY IF EXISTS "workspaces_insert_for_authenticated" ON public.workspaces;
CREATE POLICY "workspaces_insert_for_authenticated"
    ON public.workspaces
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- UPDATE: somente owner ou admin
DROP POLICY IF EXISTS "workspaces_update_for_owner_admin" ON public.workspaces;
CREATE POLICY "workspaces_update_for_owner_admin"
    ON public.workspaces
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('owner', 'admin')
        )
    );

-- DELETE: somente owner
DROP POLICY IF EXISTS "workspaces_delete_for_owner" ON public.workspaces;
CREATE POLICY "workspaces_delete_for_owner"
    ON public.workspaces
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role = 'owner'
        )
    );

-- Policies para workspace_members
-- SELECT: permitido se user_id = auth.uid() OU se o workspace foi criado por auth.uid()
-- Isso evita recursão infinita (não consulta workspace_members dentro da policy)
-- Para MC1, isso é suficiente pois cada usuário geralmente gerencia apenas seu próprio workspace
DROP POLICY IF EXISTS "workspace_members_select_for_members" ON public.workspace_members;
CREATE POLICY "workspace_members_select_for_members"
    ON public.workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

-- INSERT: owner/admin OU criador do workspace se adicionando como owner (primeira vez)
DROP POLICY IF EXISTS "workspace_members_insert_for_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_for_owner_admin"
    ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        -- Permite se já é owner/admin do workspace
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
        OR
        -- Permite se é o criador do workspace e está se adicionando como owner (primeira vez)
        (
            EXISTS (
                SELECT 1 FROM public.workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.created_by = auth.uid()
            )
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role = 'owner'
            AND NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
            )
        )
    );

-- UPDATE: apenas owner ou admin do workspace
DROP POLICY IF EXISTS "workspace_members_update_for_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_for_owner_admin"
    ON public.workspace_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- DELETE: apenas owner ou admin do workspace (não pode remover a si mesmo se for o único owner)
DROP POLICY IF EXISTS "workspace_members_delete_for_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_for_owner_admin"
    ON public.workspace_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Função para criar workspace padrão para novo usuário
CREATE OR REPLACE FUNCTION public.create_default_workspace_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_workspace_id uuid;
BEGIN
    -- Criar workspace padrão
    INSERT INTO public.workspaces (name, created_by)
    VALUES ('Meu Workspace', NEW.id)
    RETURNING id INTO new_workspace_id;

    -- Adicionar usuário como owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

-- Trigger para criar workspace padrão quando novo usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created_create_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_create_workspace
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_workspace_for_new_user();



-- ========== 20251220_000002_mc2_core.sql ==========
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



-- ========== 20251221_000003_mc2_1_entity_enrichment.sql ==========
-- MC2.1 - Entity Enrichment (CNPJ lookup)
-- Adiciona campos para enriquecimento de dados de PJ e tabela de auditoria

-- 1. Adicionar colunas de enriquecimento em entities (todas nullable)
ALTER TABLE public.entities
ADD COLUMN IF NOT EXISTS trade_name TEXT,
ADD COLUMN IF NOT EXISTS registration_status TEXT,
ADD COLUMN IF NOT EXISTS registration_status_date DATE,
ADD COLUMN IF NOT EXISTS foundation_date DATE,
ADD COLUMN IF NOT EXISTS main_activity_code TEXT,
ADD COLUMN IF NOT EXISTS main_activity_desc TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_district TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS source_provider TEXT,
ADD COLUMN IF NOT EXISTS source_fetched_at TIMESTAMPTZ;

-- 2. Criar tabela de auditoria de enriquecimento
CREATE TABLE IF NOT EXISTS public.entity_enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  document TEXT NOT NULL,
  payload_raw JSONB NOT NULL,
  fetched_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_entity_enrichment_logs_workspace_id 
  ON public.entity_enrichment_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entity_enrichment_logs_entity_id 
  ON public.entity_enrichment_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_enrichment_logs_fetched_by 
  ON public.entity_enrichment_logs(fetched_by);
CREATE INDEX IF NOT EXISTS idx_entity_enrichment_logs_document 
  ON public.entity_enrichment_logs(document);

-- 4. Habilitar RLS
ALTER TABLE public.entity_enrichment_logs ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist (idempotência)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_enrichment_logs'
      AND policyname = 'entity_enrichment_logs_select_for_members'
  ) THEN
    DROP POLICY entity_enrichment_logs_select_for_members ON public.entity_enrichment_logs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_enrichment_logs'
      AND policyname = 'entity_enrichment_logs_insert_for_members'
  ) THEN
    DROP POLICY entity_enrichment_logs_insert_for_members ON public.entity_enrichment_logs;
  END IF;
END
$$;

-- 6. Policies para entity_enrichment_logs
-- SELECT: apenas membros do workspace
CREATE POLICY entity_enrichment_logs_select_for_members
  ON public.entity_enrichment_logs
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: apenas membros do workspace, fetched_by deve ser o usuário autenticado
CREATE POLICY entity_enrichment_logs_insert_for_members
  ON public.entity_enrichment_logs
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
    AND fetched_by = auth.uid()
  );



-- ========== 20251221_000004_mc3_cards_installments.sql ==========
-- MC3: Cartões + Compras Parceladas (Agenda automática por ciclo)
-- Migration idempotente para criação do schema de cartões e parcelas

-- ========================================
-- CARDS (Cartões de Crédito)
-- ========================================
CREATE TABLE IF NOT EXISTS public.cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    name text NOT NULL,
    brand text,
    closing_day int NOT NULL CHECK (closing_day >= 1 AND closing_day <= 28),
    due_day int NOT NULL CHECK (due_day >= 1 AND due_day <= 28),
    currency text NOT NULL DEFAULT 'BRL',
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para cards
CREATE INDEX IF NOT EXISTS idx_cards_workspace_id_entity_id ON public.cards(workspace_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_cards_workspace_id_active ON public.cards(workspace_id, is_active);

-- ========================================
-- CARD_PURCHASES (Compra mestre)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    purchase_date date NOT NULL,
    merchant text,
    description text,
    category_id uuid,
    total_amount numeric(14,2) NOT NULL CHECK (total_amount > 0),
    installments int NOT NULL CHECK (installments >= 1),
    first_installment_month date,
    created_by uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para card_purchases
CREATE INDEX IF NOT EXISTS idx_card_purchases_workspace_entity_card ON public.card_purchases(workspace_id, entity_id, card_id);
CREATE INDEX IF NOT EXISTS idx_card_purchases_workspace_date ON public.card_purchases(workspace_id, purchase_date);

-- ========================================
-- CARD_INSTALLMENTS (Agenda de parcelas)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    purchase_id uuid NOT NULL REFERENCES public.card_purchases(id) ON DELETE CASCADE,
    installment_number int NOT NULL,
    competence_month date NOT NULL,
    amount numeric(14,2) NOT NULL,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'canceled')),
    posted_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(purchase_id, installment_number)
);

-- Índices para card_installments
CREATE INDEX IF NOT EXISTS idx_card_installments_workspace_card_month ON public.card_installments(workspace_id, card_id, competence_month);
CREATE INDEX IF NOT EXISTS idx_card_installments_workspace_entity_month ON public.card_installments(workspace_id, entity_id, competence_month);
CREATE INDEX IF NOT EXISTS idx_card_installments_status ON public.card_installments(status);

-- ========================================
-- CARD_AUDIT_LOG (Auditoria)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para card_audit_log
CREATE INDEX IF NOT EXISTS idx_card_audit_log_workspace_id ON public.card_audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_log_resource ON public.card_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_log_created_at ON public.card_audit_log(created_at);

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_audit_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - CARDS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "cards_select_for_members" ON public.cards;
CREATE POLICY "cards_select_for_members"
    ON public.cards
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity do mesmo workspace
DROP POLICY IF EXISTS "cards_insert_for_members" ON public.cards;
CREATE POLICY "cards_insert_for_members"
    ON public.cards
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
            WHERE workspace_id = cards.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace (não permite trocar workspace_id)
DROP POLICY IF EXISTS "cards_update_for_members" ON public.cards;
CREATE POLICY "cards_update_for_members"
    ON public.cards
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "cards_delete_for_members" ON public.cards;
CREATE POLICY "cards_delete_for_members"
    ON public.cards
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CARD_PURCHASES
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "card_purchases_select_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_select_for_members"
    ON public.card_purchases
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity/card do mesmo workspace
DROP POLICY IF EXISTS "card_purchases_insert_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_insert_for_members"
    ON public.card_purchases
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
            WHERE workspace_id = card_purchases.workspace_id
        )
        AND card_id IN (
            SELECT id
            FROM public.cards
            WHERE workspace_id = card_purchases.workspace_id
        )
        AND created_by = auth.uid()
    );

-- UPDATE: Apenas membros do workspace (não permite trocar workspace_id)
DROP POLICY IF EXISTS "card_purchases_update_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_update_for_members"
    ON public.card_purchases
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "card_purchases_delete_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_delete_for_members"
    ON public.card_purchases
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CARD_INSTALLMENTS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "card_installments_select_for_members" ON public.card_installments;
CREATE POLICY "card_installments_select_for_members"
    ON public.card_installments
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity/card/purchase do mesmo workspace
DROP POLICY IF EXISTS "card_installments_insert_for_members" ON public.card_installments;
CREATE POLICY "card_installments_insert_for_members"
    ON public.card_installments
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
            WHERE workspace_id = card_installments.workspace_id
        )
        AND card_id IN (
            SELECT id
            FROM public.cards
            WHERE workspace_id = card_installments.workspace_id
        )
        AND purchase_id IN (
            SELECT id
            FROM public.card_purchases
            WHERE workspace_id = card_installments.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace (não permite trocar workspace_id)
DROP POLICY IF EXISTS "card_installments_update_for_members" ON public.card_installments;
CREATE POLICY "card_installments_update_for_members"
    ON public.card_installments
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "card_installments_delete_for_members" ON public.card_installments;
CREATE POLICY "card_installments_delete_for_members"
    ON public.card_installments
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CARD_AUDIT_LOG
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "card_audit_log_select_for_members" ON public.card_audit_log;
CREATE POLICY "card_audit_log_select_for_members"
    ON public.card_audit_log
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e actor_user_id = auth.uid()
DROP POLICY IF EXISTS "card_audit_log_insert_for_members" ON public.card_audit_log;
CREATE POLICY "card_audit_log_insert_for_members"
    ON public.card_audit_log
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND actor_user_id = auth.uid()
    );



-- ========== 20251221_000005_mc3_1_connectors_foundation.sql ==========
-- MC3.1: Connectors Foundation - Base para ingestão automática e conciliação
-- Migration idempotente para criação do schema de conectores

-- ========================================
-- PROVIDERS (Provedores de dados)
-- ========================================
CREATE TABLE IF NOT EXISTS public.providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('aggregator', 'open_finance_direct')),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
    config jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_workspace_id ON public.providers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_providers_status ON public.providers(status);

-- ========================================
-- CONNECTIONS (Conexões com provedores)
-- ========================================
CREATE TABLE IF NOT EXISTS public.connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'needs_setup' CHECK (status IN ('needs_setup', 'connecting', 'active', 'error', 'revoked')),
    external_connection_id text,
    last_sync_at timestamptz,
    last_error text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connections_workspace_id ON public.connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connections_entity_id ON public.connections(entity_id);
CREATE INDEX IF NOT EXISTS idx_connections_provider_id ON public.connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON public.connections(status);

-- ========================================
-- EXTERNAL_ACCOUNTS (Contas externas descobertas)
-- ========================================
CREATE TABLE IF NOT EXISTS public.external_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
    external_account_id text NOT NULL,
    display_name text NOT NULL,
    type text NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'investment', 'other')),
    currency text NOT NULL DEFAULT 'BRL',
    status text NOT NULL DEFAULT 'active',
    raw jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, connection_id, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_external_accounts_workspace_id ON public.external_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_external_accounts_entity_id ON public.external_accounts(entity_id);
CREATE INDEX IF NOT EXISTS idx_external_accounts_connection_id ON public.external_accounts(connection_id);

-- ========================================
-- EXTERNAL_ACCOUNT_MAP (Mapeamento external -> internal)
-- ========================================
CREATE TABLE IF NOT EXISTS public.external_account_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    external_account_id uuid NOT NULL REFERENCES public.external_accounts(id) ON DELETE CASCADE,
    internal_account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
    internal_card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
    mapping_status text NOT NULL DEFAULT 'mapped' CHECK (mapping_status IN ('mapped', 'unmapped', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT external_account_map_one_target CHECK (
        (internal_account_id IS NOT NULL AND internal_card_id IS NULL) OR
        (internal_account_id IS NULL AND internal_card_id IS NOT NULL) OR
        (internal_account_id IS NULL AND internal_card_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_external_account_map_workspace_id ON public.external_account_map(workspace_id);
CREATE INDEX IF NOT EXISTS idx_external_account_map_external ON public.external_account_map(external_account_id);
CREATE INDEX IF NOT EXISTS idx_external_account_map_internal_account ON public.external_account_map(internal_account_id);
CREATE INDEX IF NOT EXISTS idx_external_account_map_internal_card ON public.external_account_map(internal_card_id);

-- ========================================
-- EXTERNAL_TRANSACTIONS (Transações externas ingeridas)
-- ========================================
CREATE TABLE IF NOT EXISTS public.external_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    external_account_id uuid NOT NULL REFERENCES public.external_accounts(id) ON DELETE CASCADE,
    external_tx_id text NOT NULL,
    posted_at date NOT NULL,
    amount numeric(15,2) NOT NULL,
    direction text NOT NULL CHECK (direction IN ('in', 'out')),
    description_raw text NOT NULL,
    description_norm text,
    balance_after numeric(15,2),
    category_hint text,
    raw jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, external_account_id, external_tx_id)
);

CREATE INDEX IF NOT EXISTS idx_external_transactions_workspace_id ON public.external_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_external_transactions_entity_id ON public.external_transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_external_transactions_external_account_id ON public.external_transactions(external_account_id);
CREATE INDEX IF NOT EXISTS idx_external_transactions_posted_at ON public.external_transactions(posted_at);
CREATE INDEX IF NOT EXISTS idx_external_transactions_description_norm ON public.external_transactions(description_norm);

-- ========================================
-- SYNC_RUNS (Execuções de sincronização)
-- ========================================
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
    inserted_count int DEFAULT 0,
    updated_count int DEFAULT 0,
    deduped_count int DEFAULT 0,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_workspace_id ON public.sync_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_connection_id ON public.sync_runs(connection_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON public.sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON public.sync_runs(started_at);

-- ========================================
-- RECONCILIATION_LINKS (Links de conciliação)
-- ========================================
CREATE TABLE IF NOT EXISTS public.reconciliation_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    external_transaction_id uuid NOT NULL REFERENCES public.external_transactions(id) ON DELETE CASCADE,
    internal_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    match_type text NOT NULL CHECK (match_type IN ('exact', 'heuristic', 'manual')),
    confidence numeric(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    evidence jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_links_workspace_id ON public.reconciliation_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_links_external_tx ON public.reconciliation_links(external_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_links_internal_tx ON public.reconciliation_links(internal_transaction_id);

-- ========================================
-- CONNECTORS_AUDIT_LOG (Auditoria de conectores)
-- ========================================
CREATE TABLE IF NOT EXISTS public.connectors_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connectors_audit_log_workspace_id ON public.connectors_audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connectors_audit_log_resource ON public.connectors_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_connectors_audit_log_created_at ON public.connectors_audit_log(created_at);

-- ========================================
-- CARD_TEMPLATES (Templates de cartões)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_name text NOT NULL,
    program_name text,
    suggested_brand text,
    suggested_closing_day int CHECK (suggested_closing_day >= 1 AND suggested_closing_day <= 28),
    suggested_due_day int CHECK (suggested_due_day >= 1 AND suggested_due_day <= 28),
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(issuer_name, program_name)
);

-- Seed de templates básicos
-- Nota: card_templates é global (não tem workspace_id), então não precisa de RLS
DO $$
BEGIN
  INSERT INTO public.card_templates (issuer_name, program_name, suggested_brand, suggested_closing_day, suggested_due_day) VALUES
    ('Nubank', NULL, 'Mastercard', 15, 22),
    ('Itaú', 'Latam Pass', 'Visa', 10, 20),
    ('Bradesco', 'Smiles', 'Mastercard', 8, 18),
    ('Santander', 'TudoAzul', 'Visa', 12, 22),
    ('Banco do Brasil', NULL, 'Visa', 5, 15),
    ('Caixa', NULL, 'Visa', 10, 20),
    ('Inter', NULL, 'Mastercard', 15, 25),
    ('C6', NULL, 'Mastercard', 10, 20),
    ('BTG', NULL, 'Mastercard', 12, 22),
    ('Safra', NULL, 'Visa', 8, 18),
    ('XP', NULL, 'Mastercard', 10, 20),
    ('PicPay', NULL, 'Mastercard', 15, 25)
  ON CONFLICT DO NOTHING;
END $$;

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_account_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectors_audit_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - PROVIDERS
-- ========================================

DROP POLICY IF EXISTS "providers_select_for_members" ON public.providers;
CREATE POLICY "providers_select_for_members"
    ON public.providers
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "providers_insert_for_members" ON public.providers;
CREATE POLICY "providers_insert_for_members"
    ON public.providers
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "providers_update_for_members" ON public.providers;
CREATE POLICY "providers_update_for_members"
    ON public.providers
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CONNECTIONS
-- ========================================

DROP POLICY IF EXISTS "connections_select_for_members" ON public.connections;
CREATE POLICY "connections_select_for_members"
    ON public.connections
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "connections_insert_for_members" ON public.connections;
CREATE POLICY "connections_insert_for_members"
    ON public.connections
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
            WHERE workspace_id = connections.workspace_id
        )
        AND provider_id IN (
            SELECT id
            FROM public.providers
            WHERE workspace_id = connections.workspace_id
        )
    );

DROP POLICY IF EXISTS "connections_update_for_members" ON public.connections;
CREATE POLICY "connections_update_for_members"
    ON public.connections
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - EXTERNAL_ACCOUNTS
-- ========================================

DROP POLICY IF EXISTS "external_accounts_select_for_members" ON public.external_accounts;
CREATE POLICY "external_accounts_select_for_members"
    ON public.external_accounts
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "external_accounts_insert_for_members" ON public.external_accounts;
CREATE POLICY "external_accounts_insert_for_members"
    ON public.external_accounts
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
            WHERE workspace_id = external_accounts.workspace_id
        )
        AND connection_id IN (
            SELECT id
            FROM public.connections
            WHERE workspace_id = external_accounts.workspace_id
        )
    );

DROP POLICY IF EXISTS "external_accounts_update_for_members" ON public.external_accounts;
CREATE POLICY "external_accounts_update_for_members"
    ON public.external_accounts
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - EXTERNAL_ACCOUNT_MAP
-- ========================================

DROP POLICY IF EXISTS "external_account_map_select_for_members" ON public.external_account_map;
CREATE POLICY "external_account_map_select_for_members"
    ON public.external_account_map
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "external_account_map_insert_for_members" ON public.external_account_map;
CREATE POLICY "external_account_map_insert_for_members"
    ON public.external_account_map
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND external_account_id IN (
            SELECT id
            FROM public.external_accounts
            WHERE workspace_id = external_account_map.workspace_id
        )
    );

DROP POLICY IF EXISTS "external_account_map_update_for_members" ON public.external_account_map;
CREATE POLICY "external_account_map_update_for_members"
    ON public.external_account_map
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - EXTERNAL_TRANSACTIONS
-- ========================================

DROP POLICY IF EXISTS "external_transactions_select_for_members" ON public.external_transactions;
CREATE POLICY "external_transactions_select_for_members"
    ON public.external_transactions
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "external_transactions_insert_for_members" ON public.external_transactions;
CREATE POLICY "external_transactions_insert_for_members"
    ON public.external_transactions
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
            WHERE workspace_id = external_transactions.workspace_id
        )
        AND external_account_id IN (
            SELECT id
            FROM public.external_accounts
            WHERE workspace_id = external_transactions.workspace_id
        )
    );

DROP POLICY IF EXISTS "external_transactions_update_for_members" ON public.external_transactions;
CREATE POLICY "external_transactions_update_for_members"
    ON public.external_transactions
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - SYNC_RUNS
-- ========================================

DROP POLICY IF EXISTS "sync_runs_select_for_members" ON public.sync_runs;
CREATE POLICY "sync_runs_select_for_members"
    ON public.sync_runs
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "sync_runs_insert_for_members" ON public.sync_runs;
CREATE POLICY "sync_runs_insert_for_members"
    ON public.sync_runs
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND connection_id IN (
            SELECT id
            FROM public.connections
            WHERE workspace_id = sync_runs.workspace_id
        )
    );

-- ========================================
-- RLS POLICIES - RECONCILIATION_LINKS
-- ========================================

DROP POLICY IF EXISTS "reconciliation_links_select_for_members" ON public.reconciliation_links;
CREATE POLICY "reconciliation_links_select_for_members"
    ON public.reconciliation_links
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "reconciliation_links_insert_for_members" ON public.reconciliation_links;
CREATE POLICY "reconciliation_links_insert_for_members"
    ON public.reconciliation_links
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND external_transaction_id IN (
            SELECT id
            FROM public.external_transactions
            WHERE workspace_id = reconciliation_links.workspace_id
        )
        AND internal_transaction_id IN (
            SELECT id
            FROM public.transactions
            WHERE workspace_id = reconciliation_links.workspace_id
        )
    );

DROP POLICY IF EXISTS "reconciliation_links_delete_for_members" ON public.reconciliation_links;
CREATE POLICY "reconciliation_links_delete_for_members"
    ON public.reconciliation_links
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CONNECTORS_AUDIT_LOG
-- ========================================

DROP POLICY IF EXISTS "connectors_audit_log_select_for_members" ON public.connectors_audit_log;
CREATE POLICY "connectors_audit_log_select_for_members"
    ON public.connectors_audit_log
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "connectors_audit_log_insert_for_members" ON public.connectors_audit_log;
CREATE POLICY "connectors_audit_log_insert_for_members"
    ON public.connectors_audit_log
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND actor_user_id = auth.uid()
    );



-- ========== 20251221_000006_mc3_1b_provider_catalog.sql ==========
-- MC3.1b: Provider Catalog (catálogo global de providers)
-- Migration idempotente para criar catálogo de providers

-- ========================================
-- PROVIDER_CATALOG (Catálogo global de providers disponíveis)
-- ========================================
CREATE TABLE IF NOT EXISTS public.provider_catalog (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('aggregator', 'open_finance_direct')),
    homepage text,
    docs_url text,
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed de providers disponíveis
DO $$
BEGIN
  INSERT INTO public.provider_catalog (code, name, kind, homepage, docs_url) VALUES
    ('pluggy', 'Pluggy', 'aggregator', 'https://pluggy.ai', 'https://docs.pluggy.ai'),
    ('belvo', 'Belvo', 'aggregator', 'https://belvo.com', 'https://developers.belvo.com'),
    ('openfinance_direct', 'Open Finance Direto', 'open_finance_direct', NULL, NULL)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- Índice para busca
CREATE INDEX IF NOT EXISTS idx_provider_catalog_code ON public.provider_catalog(code);
CREATE INDEX IF NOT EXISTS idx_provider_catalog_kind ON public.provider_catalog(kind);
CREATE INDEX IF NOT EXISTS idx_provider_catalog_active ON public.provider_catalog(is_active);

-- ========================================
-- Ajustar tabela PROVIDERS para referenciar catalog
-- ========================================
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS catalog_id uuid REFERENCES public.provider_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_providers_catalog_workspace ON public.providers(catalog_id, workspace_id);

-- ========================================
-- RLS - PROVIDER_CATALOG (leitura pública para authenticated users)
-- ========================================
ALTER TABLE public.provider_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_catalog_select_for_authenticated" ON public.provider_catalog;
CREATE POLICY "provider_catalog_select_for_authenticated"
    ON public.provider_catalog
    FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_active = true);



-- ========== 20251221_000007_mc4_1_commitments_contracts.sql ==========
-- MC4.1: Commitments, Contracts & Events
-- Migration idempotente para criação do schema de compromissos, contratos e cronogramas financeiros

-- ========================================
-- FINANCIAL_COMMITMENTS (Compromissos Financeiros)
-- ========================================
CREATE TABLE IF NOT EXISTS public.financial_commitments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('expense', 'revenue')),
    category text,
    description text NOT NULL,
    total_amount numeric(15,2) NOT NULL CHECK (total_amount > 0),
    currency text NOT NULL DEFAULT 'BRL',
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    start_date date NOT NULL,
    end_date date,
    recurrence text DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'yearly', 'custom')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_commitments_workspace_id ON public.financial_commitments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_entity_id ON public.financial_commitments(entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_type ON public.financial_commitments(type);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_status ON public.financial_commitments(status);
CREATE INDEX IF NOT EXISTS idx_financial_commitments_start_date ON public.financial_commitments(start_date);

-- ========================================
-- FINANCIAL_SCHEDULES (Cronogramas Financeiros)
-- ========================================
CREATE TABLE IF NOT EXISTS public.financial_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id uuid NOT NULL REFERENCES public.financial_commitments(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    due_date date NOT NULL,
    amount numeric(15,2) NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'realized', 'cancelled')),
    linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_schedules_commitment_id ON public.financial_schedules(commitment_id);
CREATE INDEX IF NOT EXISTS idx_financial_schedules_workspace_id ON public.financial_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_financial_schedules_due_date ON public.financial_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_schedules_status ON public.financial_schedules(status);
CREATE INDEX IF NOT EXISTS idx_financial_schedules_linked_transaction_id ON public.financial_schedules(linked_transaction_id);

-- ========================================
-- CONTRACTS (Contratos / Projetos)
-- ========================================
CREATE TABLE IF NOT EXISTS public.contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    counterparty_entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    total_value numeric(15,2) NOT NULL CHECK (total_value > 0),
    currency text NOT NULL DEFAULT 'BRL',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    start_date date NOT NULL,
    end_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_workspace_id ON public.contracts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contracts_counterparty_entity_id ON public.contracts(counterparty_entity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON public.contracts(start_date);

-- ========================================
-- CONTRACT_SCHEDULES (Cronogramas de Contratos)
-- ========================================
CREATE TABLE IF NOT EXISTS public.contract_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('receivable', 'payable')),
    due_date date NOT NULL,
    amount numeric(15,2) NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'received', 'paid', 'cancelled')),
    linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_schedules_contract_id ON public.contract_schedules(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_workspace_id ON public.contract_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_type ON public.contract_schedules(type);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_due_date ON public.contract_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_status ON public.contract_schedules(status);
CREATE INDEX IF NOT EXISTS idx_contract_schedules_linked_transaction_id ON public.contract_schedules(linked_transaction_id);

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_schedules ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - FINANCIAL_COMMITMENTS
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_commitments'
      AND policyname = 'financial_commitments_select_for_members'
  ) THEN
    DROP POLICY financial_commitments_select_for_members ON public.financial_commitments;
  END IF;
END
$$;

CREATE POLICY financial_commitments_select_for_members
    ON public.financial_commitments
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_commitments'
      AND policyname = 'financial_commitments_insert_for_members'
  ) THEN
    DROP POLICY financial_commitments_insert_for_members ON public.financial_commitments;
  END IF;
END
$$;

CREATE POLICY financial_commitments_insert_for_members
    ON public.financial_commitments
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
            WHERE workspace_id = financial_commitments.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_commitments'
      AND policyname = 'financial_commitments_update_for_members'
  ) THEN
    DROP POLICY financial_commitments_update_for_members ON public.financial_commitments;
  END IF;
END
$$;

CREATE POLICY financial_commitments_update_for_members
    ON public.financial_commitments
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_commitments'
      AND policyname = 'financial_commitments_delete_for_members'
  ) THEN
    DROP POLICY financial_commitments_delete_for_members ON public.financial_commitments;
  END IF;
END
$$;

CREATE POLICY financial_commitments_delete_for_members
    ON public.financial_commitments
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - FINANCIAL_SCHEDULES
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_schedules'
      AND policyname = 'financial_schedules_select_for_members'
  ) THEN
    DROP POLICY financial_schedules_select_for_members ON public.financial_schedules;
  END IF;
END
$$;

CREATE POLICY financial_schedules_select_for_members
    ON public.financial_schedules
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_schedules'
      AND policyname = 'financial_schedules_insert_for_members'
  ) THEN
    DROP POLICY financial_schedules_insert_for_members ON public.financial_schedules;
  END IF;
END
$$;

CREATE POLICY financial_schedules_insert_for_members
    ON public.financial_schedules
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND commitment_id IN (
            SELECT id
            FROM public.financial_commitments
            WHERE workspace_id = financial_schedules.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_schedules'
      AND policyname = 'financial_schedules_update_for_members'
  ) THEN
    DROP POLICY financial_schedules_update_for_members ON public.financial_schedules;
  END IF;
END
$$;

CREATE POLICY financial_schedules_update_for_members
    ON public.financial_schedules
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_schedules'
      AND policyname = 'financial_schedules_delete_for_members'
  ) THEN
    DROP POLICY financial_schedules_delete_for_members ON public.financial_schedules;
  END IF;
END
$$;

CREATE POLICY financial_schedules_delete_for_members
    ON public.financial_schedules
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CONTRACTS
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contracts'
      AND policyname = 'contracts_select_for_members'
  ) THEN
    DROP POLICY contracts_select_for_members ON public.contracts;
  END IF;
END
$$;

CREATE POLICY contracts_select_for_members
    ON public.contracts
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contracts'
      AND policyname = 'contracts_insert_for_members'
  ) THEN
    DROP POLICY contracts_insert_for_members ON public.contracts;
  END IF;
END
$$;

CREATE POLICY contracts_insert_for_members
    ON public.contracts
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND counterparty_entity_id IN (
            SELECT id
            FROM public.entities
            WHERE workspace_id = contracts.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contracts'
      AND policyname = 'contracts_update_for_members'
  ) THEN
    DROP POLICY contracts_update_for_members ON public.contracts;
  END IF;
END
$$;

CREATE POLICY contracts_update_for_members
    ON public.contracts
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contracts'
      AND policyname = 'contracts_delete_for_members'
  ) THEN
    DROP POLICY contracts_delete_for_members ON public.contracts;
  END IF;
END
$$;

CREATE POLICY contracts_delete_for_members
    ON public.contracts
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CONTRACT_SCHEDULES
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_schedules'
      AND policyname = 'contract_schedules_select_for_members'
  ) THEN
    DROP POLICY contract_schedules_select_for_members ON public.contract_schedules;
  END IF;
END
$$;

CREATE POLICY contract_schedules_select_for_members
    ON public.contract_schedules
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_schedules'
      AND policyname = 'contract_schedules_insert_for_members'
  ) THEN
    DROP POLICY contract_schedules_insert_for_members ON public.contract_schedules;
  END IF;
END
$$;

CREATE POLICY contract_schedules_insert_for_members
    ON public.contract_schedules
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND contract_id IN (
            SELECT id
            FROM public.contracts
            WHERE workspace_id = contract_schedules.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_schedules'
      AND policyname = 'contract_schedules_update_for_members'
  ) THEN
    DROP POLICY contract_schedules_update_for_members ON public.contract_schedules;
  END IF;
END
$$;

CREATE POLICY contract_schedules_update_for_members
    ON public.contract_schedules
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_schedules'
      AND policyname = 'contract_schedules_delete_for_members'
  ) THEN
    DROP POLICY contract_schedules_delete_for_members ON public.contract_schedules;
  END IF;
END
$$;

CREATE POLICY contract_schedules_delete_for_members
    ON public.contract_schedules
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );



-- ========== 20251221_000008_mc4_1_rls_insert_fix.sql ==========
-- MC4.1 RLS INSERT Fix - Corrigir policies de INSERT para evitar bloqueios por expressões frágeis
-- Migration idempotente

-- ========================================
-- FINANCIAL_COMMITMENTS - Corrigir INSERT
-- ========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_commitments'
      AND policyname = 'financial_commitments_insert_for_members'
  ) THEN
    DROP POLICY financial_commitments_insert_for_members ON public.financial_commitments;
  END IF;
END
$$;

CREATE POLICY financial_commitments_insert_for_members
    ON public.financial_commitments
    FOR INSERT
    WITH CHECK (
        -- Usuário é membro do workspace
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = financial_commitments.workspace_id
            AND wm.user_id = auth.uid()
        )
        -- Entity pertence ao mesmo workspace
        AND EXISTS (
            SELECT 1
            FROM public.entities e
            WHERE e.id = financial_commitments.entity_id
            AND e.workspace_id = financial_commitments.workspace_id
        )
    );

-- ========================================
-- FINANCIAL_SCHEDULES - Corrigir INSERT
-- ========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_schedules'
      AND policyname = 'financial_schedules_insert_for_members'
  ) THEN
    DROP POLICY financial_schedules_insert_for_members ON public.financial_schedules;
  END IF;
END
$$;

CREATE POLICY financial_schedules_insert_for_members
    ON public.financial_schedules
    FOR INSERT
    WITH CHECK (
        -- Usuário é membro do workspace
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = financial_schedules.workspace_id
            AND wm.user_id = auth.uid()
        )
        -- Commitment pertence ao mesmo workspace
        AND EXISTS (
            SELECT 1
            FROM public.financial_commitments c
            WHERE c.id = financial_schedules.commitment_id
            AND c.workspace_id = financial_schedules.workspace_id
        )
    );

-- ========================================
-- CONTRACTS - Corrigir INSERT
-- ========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contracts'
      AND policyname = 'contracts_insert_for_members'
  ) THEN
    DROP POLICY contracts_insert_for_members ON public.contracts;
  END IF;
END
$$;

CREATE POLICY contracts_insert_for_members
    ON public.contracts
    FOR INSERT
    WITH CHECK (
        -- Usuário é membro do workspace
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = contracts.workspace_id
            AND wm.user_id = auth.uid()
        )
        -- Entity contraparte pertence ao mesmo workspace
        AND EXISTS (
            SELECT 1
            FROM public.entities e
            WHERE e.id = contracts.counterparty_entity_id
            AND e.workspace_id = contracts.workspace_id
        )
    );

-- ========================================
-- CONTRACT_SCHEDULES - Corrigir INSERT
-- ========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_schedules'
      AND policyname = 'contract_schedules_insert_for_members'
  ) THEN
    DROP POLICY contract_schedules_insert_for_members ON public.contract_schedules;
  END IF;
END
$$;

CREATE POLICY contract_schedules_insert_for_members
    ON public.contract_schedules
    FOR INSERT
    WITH CHECK (
        -- Usuário é membro do workspace
        EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            WHERE wm.workspace_id = contract_schedules.workspace_id
            AND wm.user_id = auth.uid()
        )
        -- Contract pertence ao mesmo workspace
        AND EXISTS (
            SELECT 1
            FROM public.contracts c
            WHERE c.id = contract_schedules.contract_id
            AND c.workspace_id = contract_schedules.workspace_id
        )
    );



-- ========== 20251221_000009_mc4_3_3_audit_softdelete.sql ==========
-- MC4.3.3: Soft Delete + Audit Log
-- Migration idempotente

-- ========================================
-- SOFT DELETE: Adicionar deleted_at e deleted_by
-- ========================================

-- financial_commitments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'financial_commitments'
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.financial_commitments
    ADD COLUMN deleted_at timestamptz,
    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'contracts'
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.contracts
    ADD COLUMN deleted_at timestamptz,
    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- financial_schedules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'financial_schedules'
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.financial_schedules
    ADD COLUMN deleted_at timestamptz,
    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- contract_schedules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'contract_schedules'
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.contract_schedules
    ADD COLUMN deleted_at timestamptz,
    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- ========================================
-- AUDIT LOGS: Tabela para auditoria
-- ========================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL, -- create, update, delete, activate, cancel, complete, realize, link, unlink
  entity_type text NOT NULL, -- commitment, contract, financial_schedule, contract_schedule, transaction
  entity_id uuid NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON public.audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - membros do workspace podem ver logs do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'audit_logs'
    AND policyname = 'audit_logs_select_for_members'
  ) THEN
    DROP POLICY audit_logs_select_for_members ON public.audit_logs;
  END IF;
END $$;

CREATE POLICY audit_logs_select_for_members
  ON public.audit_logs
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: INSERT - apenas server-side (via service role ou função específica)
-- Não permitir INSERT direto via client para evitar bypass de auditoria
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'audit_logs'
    AND policyname = 'audit_logs_insert_server_only'
  ) THEN
    DROP POLICY audit_logs_insert_server_only ON public.audit_logs;
  END IF;
END $$;

-- Nota: INSERT será feito via server actions (service role ou função específica)
-- Por enquanto, não criar policy de INSERT via RLS (bloqueia tudo)
-- Server actions devem usar service role ou função específica com SECURITY DEFINER

-- ========================================
-- Atualizar queries existentes para excluir soft-deleted
-- ========================================

-- Nota: As queries existentes em lib/ precisarão ser atualizadas para filtrar deleted_at IS NULL
-- Isso será feito no código TypeScript, não em migrations

COMMENT ON TABLE public.audit_logs IS 'Registro de auditoria de ações no sistema';
COMMENT ON COLUMN public.audit_logs.action IS 'create, update, delete, activate, cancel, complete, realize, link, unlink';
COMMENT ON COLUMN public.audit_logs.entity_type IS 'commitment, contract, financial_schedule, contract_schedule, transaction';



-- ========== 20251221_000010_mc5_transaction_reversal.sql ==========
-- MC5: Transaction Reversal Support
-- Adiciona campo reversed_by_id para rastrear reversões contábeis

-- Adicionar campo reversed_by_id em transactions (nullable, referencia transactions.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'reversed_by_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN reversed_by_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_transactions_reversed_by_id ON public.transactions(reversed_by_id);
  END IF;
END $$;

COMMENT ON COLUMN public.transactions.reversed_by_id IS 'ID da transação que reverteu esta transação. Se NULL, transação não foi revertida.';



-- ========== 20251221_000011_mc6_monthly_cashflow.sql ==========
-- MC6: Fluxo de Caixa Mensal (Monthly Cashflow Matrix)
-- Função SQL segura para agregação mensal de previsto vs realizado
-- RLS aplicado: apenas membros do workspace podem consultar

-- ========================================
-- FUNÇÃO: get_monthly_cashflow_matrix
-- ========================================
-- Retorna matriz mensal de fluxo de caixa agregado
-- Parâmetros:
--   p_workspace_id: workspace do usuário (validado via RLS)
--   p_from_month: data inicial (primeiro dia do mês) - formato YYYY-MM-01
--   p_to_month: data final (primeiro dia do mês) - formato YYYY-MM-01
--   p_entity_id: (opcional) filtrar por entidade
--   p_account_id: (opcional) filtrar por conta (apenas para realizado)
--
-- Retorna: JSON com array de meses, cada um contendo:
--   month_start, planned_income, planned_expense, realised_income, realised_expense,
--   planned_net, realised_net, planned_cum, realised_cum
--   metadata: min_cum_balance, min_cum_month

CREATE OR REPLACE FUNCTION public.get_monthly_cashflow_matrix(
  p_workspace_id uuid,
  p_from_month date,
  p_to_month date,
  p_entity_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_user_id uuid;
BEGIN
  -- Validar que o usuário pertence ao workspace
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: workspace não encontrado ou sem permissão';
  END IF;
  
  -- Validar intervalo
  IF p_from_month > p_to_month THEN
    RAISE EXCEPTION 'Data inicial deve ser menor ou igual à data final';
  END IF;
  
  -- Gerar série mensal e calcular agregações
  WITH month_series AS (
    SELECT 
      generate_series(
        date_trunc('month', p_from_month),
        date_trunc('month', p_to_month),
        '1 month'::interval
      )::date AS month_start
  ),
  -- Previsto: schedules PLANNED (não cancelled, sem linked_transaction)
  planned_data AS (
    SELECT 
      date_trunc('month', fs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN fc.type = 'revenue' THEN fs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN fc.type = 'expense' THEN fs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.financial_schedules fs
    INNER JOIN public.financial_commitments fc ON fs.commitment_id = fc.id
    WHERE fs.workspace_id = p_workspace_id
      AND fs.status = 'planned'
      AND fs.linked_transaction_id IS NULL
      AND fs.deleted_at IS NULL
      AND fc.deleted_at IS NULL
      AND date_trunc('month', fs.due_date)::date >= p_from_month
      AND date_trunc('month', fs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR fc.entity_id = p_entity_id)
    GROUP BY date_trunc('month', fs.due_date)::date
    
    UNION ALL
    
    -- Contract schedules PLANNED
    SELECT 
      date_trunc('month', cs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN cs.type = 'receivable' THEN cs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN cs.type = 'payable' THEN cs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.contract_schedules cs
    INNER JOIN public.contracts c ON cs.contract_id = c.id
    WHERE cs.workspace_id = p_workspace_id
      AND cs.status = 'planned'
      AND cs.linked_transaction_id IS NULL
      AND cs.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND date_trunc('month', cs.due_date)::date >= p_from_month
      AND date_trunc('month', cs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR c.counterparty_entity_id = p_entity_id)
    GROUP BY date_trunc('month', cs.due_date)::date
  ),
  planned_agg AS (
    SELECT 
      month_start,
      COALESCE(SUM(planned_income), 0) AS planned_income,
      COALESCE(SUM(planned_expense), 0) AS planned_expense
    FROM planned_data
    GROUP BY month_start
  ),
  -- Realizado: transactions (não reversed)
  realised_data AS (
    SELECT 
      date_trunc('month', t.date)::date AS month_start,
      SUM(CASE 
        WHEN t.type = 'income' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_income,
      SUM(CASE 
        WHEN t.type = 'expense' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_expense
    FROM public.transactions t
    WHERE t.workspace_id = p_workspace_id
      AND t.reversed_by_id IS NULL
      AND date_trunc('month', t.date)::date >= p_from_month
      AND date_trunc('month', t.date)::date <= p_to_month
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
    GROUP BY date_trunc('month', t.date)::date
  ),
  -- Combinar meses e calcular acumulado
  monthly_data AS (
    SELECT 
      ms.month_start,
      COALESCE(pa.planned_income, 0) AS planned_income,
      COALESCE(pa.planned_expense, 0) AS planned_expense,
      COALESCE(rd.realised_income, 0) AS realised_income,
      COALESCE(rd.realised_expense, 0) AS realised_expense,
      COALESCE(pa.planned_income, 0) - COALESCE(pa.planned_expense, 0) AS planned_net,
      COALESCE(rd.realised_income, 0) - COALESCE(rd.realised_expense, 0) AS realised_net
    FROM month_series ms
    LEFT JOIN planned_agg pa ON ms.month_start = pa.month_start
    LEFT JOIN realised_data rd ON ms.month_start = rd.month_start
    ORDER BY ms.month_start
  ),
  -- Calcular acumulado
  with_cumulative AS (
    SELECT 
      month_start,
      planned_income,
      planned_expense,
      planned_net,
      realised_income,
      realised_expense,
      realised_net,
      SUM(planned_net) OVER (ORDER BY month_start) AS planned_cum,
      SUM(realised_net) OVER (ORDER BY month_start) AS realised_cum
    FROM monthly_data
  ),
  -- Calcular worst balance por mês (determinístico)
  with_worst_balance AS (
    SELECT 
      month_start,
      planned_cum,
      realised_cum,
      LEAST(planned_cum, realised_cum) AS worst_balance
    FROM with_cumulative
  ),
  -- Encontrar mínimo balance e primeiro mês que atinge (determinístico)
  min_cum AS (
    SELECT 
      MIN(worst_balance) AS min_cum_balance
    FROM with_worst_balance
  ),
  min_cum_month_row AS (
    SELECT 
      month_start AS min_cum_month
    FROM with_worst_balance, min_cum
    WHERE worst_balance = min_cum.min_cum_balance
    ORDER BY month_start
    LIMIT 1
  )
  SELECT json_build_object(
    'months', json_agg(
      json_build_object(
        'month_start', month_start,
        'planned_income', planned_income,
        'planned_expense', planned_expense,
        'planned_net', planned_net,
        'realised_income', realised_income,
        'realised_expense', realised_expense,
        'realised_net', realised_net,
        'planned_cum', planned_cum,
        'realised_cum', realised_cum
      ) ORDER BY month_start
    ),
    'metadata', (
      SELECT json_build_object(
        'min_cum_balance', mc.min_cum_balance,
        'min_cum_month', mcm.min_cum_month
      )
      FROM min_cum mc
      LEFT JOIN LATERAL (
        SELECT min_cum_month FROM min_cum_month_row LIMIT 1
      ) mcm ON TRUE
    )
  ) INTO v_result
  FROM with_cumulative;
  
  RETURN COALESCE(v_result, '{"months": [], "metadata": {"min_cum_balance": null, "min_cum_month": null}}'::json);
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.get_monthly_cashflow_matrix IS 'Retorna matriz mensal de fluxo de caixa (previsto vs realizado) com RLS aplicado';

-- ========================================
-- RLS: Função usa SECURITY DEFINER mas valida workspace membership
-- ========================================
-- A função valida que o usuário pertence ao workspace antes de retornar dados
-- Não é necessário criar policy adicional, pois a função já valida RLS internamente



-- ========== 20251221_000012_hotfix_cashflow_tx_status.sql ==========
-- HOTFIX: Remover dependência de transactions.status
-- A coluna status não existe na tabela transactions
-- Correção: remover filtro (t.status IS NULL OR t.status = 'posted')

CREATE OR REPLACE FUNCTION public.get_monthly_cashflow_matrix(
  p_workspace_id uuid,
  p_from_month date,
  p_to_month date,
  p_entity_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_user_id uuid;
BEGIN
  -- Validar que o usuário pertence ao workspace
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: workspace não encontrado ou sem permissão';
  END IF;
  
  -- Validar intervalo
  IF p_from_month > p_to_month THEN
    RAISE EXCEPTION 'Data inicial deve ser menor ou igual à data final';
  END IF;
  
  -- Gerar série mensal e calcular agregações
  WITH month_series AS (
    SELECT 
      generate_series(
        date_trunc('month', p_from_month),
        date_trunc('month', p_to_month),
        '1 month'::interval
      )::date AS month_start
  ),
  -- Previsto: schedules PLANNED (não cancelled, sem linked_transaction)
  planned_data AS (
    SELECT 
      date_trunc('month', fs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN fc.type = 'revenue' THEN fs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN fc.type = 'expense' THEN fs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.financial_schedules fs
    INNER JOIN public.financial_commitments fc ON fs.commitment_id = fc.id
    WHERE fs.workspace_id = p_workspace_id
      AND fs.status = 'planned'
      AND fs.linked_transaction_id IS NULL
      AND fs.deleted_at IS NULL
      AND fc.deleted_at IS NULL
      AND date_trunc('month', fs.due_date)::date >= p_from_month
      AND date_trunc('month', fs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR fc.entity_id = p_entity_id)
    GROUP BY date_trunc('month', fs.due_date)::date
    
    UNION ALL
    
    -- Contract schedules PLANNED
    SELECT 
      date_trunc('month', cs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN cs.type = 'receivable' THEN cs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN cs.type = 'payable' THEN cs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.contract_schedules cs
    INNER JOIN public.contracts c ON cs.contract_id = c.id
    WHERE cs.workspace_id = p_workspace_id
      AND cs.status = 'planned'
      AND cs.linked_transaction_id IS NULL
      AND cs.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND date_trunc('month', cs.due_date)::date >= p_from_month
      AND date_trunc('month', cs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR c.counterparty_entity_id = p_entity_id)
    GROUP BY date_trunc('month', cs.due_date)::date
  ),
  planned_agg AS (
    SELECT 
      month_start,
      COALESCE(SUM(planned_income), 0) AS planned_income,
      COALESCE(SUM(planned_expense), 0) AS planned_expense
    FROM planned_data
    GROUP BY month_start
  ),
  -- Realizado: transactions (não reversed)
  -- CORREÇÃO: Removida referência a t.status (coluna não existe)
  realised_data AS (
    SELECT 
      date_trunc('month', t.date)::date AS month_start,
      SUM(CASE 
        WHEN t.type = 'income' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_income,
      SUM(CASE 
        WHEN t.type = 'expense' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_expense
    FROM public.transactions t
    WHERE t.workspace_id = p_workspace_id
      AND t.reversed_by_id IS NULL
      AND date_trunc('month', t.date)::date >= p_from_month
      AND date_trunc('month', t.date)::date <= p_to_month
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
    GROUP BY date_trunc('month', t.date)::date
  ),
  -- Combinar meses e calcular acumulado
  monthly_data AS (
    SELECT 
      ms.month_start,
      COALESCE(pa.planned_income, 0) AS planned_income,
      COALESCE(pa.planned_expense, 0) AS planned_expense,
      COALESCE(rd.realised_income, 0) AS realised_income,
      COALESCE(rd.realised_expense, 0) AS realised_expense,
      COALESCE(pa.planned_income, 0) - COALESCE(pa.planned_expense, 0) AS planned_net,
      COALESCE(rd.realised_income, 0) - COALESCE(rd.realised_expense, 0) AS realised_net
    FROM month_series ms
    LEFT JOIN planned_agg pa ON ms.month_start = pa.month_start
    LEFT JOIN realised_data rd ON ms.month_start = rd.month_start
    ORDER BY ms.month_start
  ),
  -- Calcular acumulado
  with_cumulative AS (
    SELECT 
      month_start,
      planned_income,
      planned_expense,
      planned_net,
      realised_income,
      realised_expense,
      realised_net,
      SUM(planned_net) OVER (ORDER BY month_start) AS planned_cum,
      SUM(realised_net) OVER (ORDER BY month_start) AS realised_cum
    FROM monthly_data
  ),
  -- Calcular worst balance por mês (determinístico)
  with_worst_balance AS (
    SELECT 
      month_start,
      planned_cum,
      realised_cum,
      LEAST(planned_cum, realised_cum) AS worst_balance
    FROM with_cumulative
  ),
  -- Encontrar mínimo balance e primeiro mês que atinge (determinístico)
  min_cum AS (
    SELECT 
      MIN(worst_balance) AS min_cum_balance
    FROM with_worst_balance
  ),
  min_cum_month_row AS (
    SELECT 
      month_start AS min_cum_month
    FROM with_worst_balance, min_cum
    WHERE worst_balance = min_cum.min_cum_balance
    ORDER BY month_start
    LIMIT 1
  )
  SELECT json_build_object(
    'months', json_agg(
      json_build_object(
        'month_start', month_start,
        'planned_income', planned_income,
        'planned_expense', planned_expense,
        'planned_net', planned_net,
        'realised_income', realised_income,
        'realised_expense', realised_expense,
        'realised_net', realised_net,
        'planned_cum', planned_cum,
        'realised_cum', realised_cum
      ) ORDER BY month_start
    ),
    'metadata', (
      SELECT json_build_object(
        'min_cum_balance', min_cum.min_cum_balance,
        'min_cum_month', (SELECT min_cum_month FROM min_cum_month_row LIMIT 1)
      )
      FROM min_cum
    )
  ) INTO v_result
  FROM with_cumulative;
  
  RETURN COALESCE(v_result, '{"months": [], "metadata": {"min_cum_balance": null, "min_cum_month": null}}'::json);
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.get_monthly_cashflow_matrix IS 'Retorna matriz mensal de fluxo de caixa (previsto vs realizado) com RLS aplicado. HOTFIX: removida dependência de transactions.status (coluna inexistente)';



-- ========== 20251221_000013_mc62_account_opening_balance.sql ==========
-- MC6.2: Account Opening Balance Support
-- Adiciona campos para saldo inicial e data de referência
-- 
-- NOTA: A tabela accounts já possui opening_balance e opening_balance_date
-- Este migration apenas garante que opening_balance_as_of exista (renomeando se necessário)

-- Verificar se opening_balance_date existe e renomear para opening_balance_as_of
DO $$
BEGIN
  -- Se opening_balance_date existe e opening_balance_as_of não existe, renomear
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance_as_of'
  ) THEN
    ALTER TABLE public.accounts
    RENAME COLUMN opening_balance_date TO opening_balance_as_of;
  END IF;

  -- Se opening_balance_as_of não existe (e opening_balance_date também não), criar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance_as_of'
  ) THEN
    ALTER TABLE public.accounts
    ADD COLUMN opening_balance_as_of date;
  END IF;

  -- Garantir que opening_balance existe (já deveria existir, mas garantindo idempotência)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance'
  ) THEN
    ALTER TABLE public.accounts
    ADD COLUMN opening_balance numeric(15,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Comentários
COMMENT ON COLUMN public.accounts.opening_balance IS 'Saldo inicial da conta em sua data de abertura ou última atualização conhecida';
COMMENT ON COLUMN public.accounts.opening_balance_as_of IS 'Data de referência do saldo inicial (quando foi registrado/atualizado)';



-- ========== 20251221_000014_mc8_operational_movements.sql ==========
-- MC8: Movimentação Operacional Real (Ledger + Baixas + Transferências)
-- Adiciona campos para rastrear origem das transactions (baixas, transferências)

-- Adicionar colunas em transactions (idempotente)
DO $$
BEGIN
  -- Adicionar source_type (enum)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'source_type'
  ) THEN
    -- Criar tipo ENUM se não existir
    BEGIN
      CREATE TYPE transaction_source_type AS ENUM ('manual', 'commitment', 'installment', 'transfer', 'adjustment');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    
    ALTER TABLE public.transactions
    ADD COLUMN source_type transaction_source_type NOT NULL DEFAULT 'manual';
  END IF;

  -- Adicionar source_id (nullable, referencia ao registro de origem)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'source_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN source_id uuid;
  END IF;

  -- Adicionar direction (in | out) - substitui inferência de type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'direction'
  ) THEN
    BEGIN
      CREATE TYPE transaction_direction AS ENUM ('in', 'out');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    
    -- Preencher direction baseado em type existente
    ALTER TABLE public.transactions
    ADD COLUMN direction transaction_direction;
    
    -- Popular direction com base em type (income = in, expense = out, transfer = depende)
    UPDATE public.transactions
    SET direction = CASE
      WHEN type = 'income' THEN 'in'::transaction_direction
      WHEN type = 'expense' THEN 'out'::transaction_direction
      WHEN type = 'transfer' THEN NULL -- transfer precisa ser tratado caso a caso
      ELSE NULL
    END;
    
    -- Tornar NOT NULL após popular (mas permitir NULL temporariamente para transfer)
    ALTER TABLE public.transactions
    ALTER COLUMN direction DROP NOT NULL;
  END IF;

  -- Adicionar effective_date (data real do caixa, pode ser diferente de date)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN effective_date date;
    
    -- Popular effective_date com date existente
    UPDATE public.transactions
    SET effective_date = date;
  END IF;

  -- Adicionar transfer_group_id (para agrupar transferências)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'transfer_group_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN transfer_group_id uuid;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_source_type ON public.transactions(source_type);
CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON public.transactions(source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id ON public.transactions(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_effective_date ON public.transactions(effective_date);

-- Comentários
COMMENT ON COLUMN public.transactions.source_type IS 'Tipo de origem da transação: manual, commitment, installment, transfer, adjustment';
COMMENT ON COLUMN public.transactions.source_id IS 'ID do registro de origem (commitment_id, installment_id, etc)';
COMMENT ON COLUMN public.transactions.direction IS 'Direção do fluxo: in (entrada) ou out (saída)';
COMMENT ON COLUMN public.transactions.effective_date IS 'Data efetiva do caixa (pode ser diferente de date para projeções)';
COMMENT ON COLUMN public.transactions.transfer_group_id IS 'ID para agrupar transações de transferência (2 transações compartilham o mesmo transfer_group_id)';



-- ========== 20251222_000001_mc9_alerts.sql ==========
-- MC9: Alertas Inteligentes - Tabela e RLS
-- Migration idempotente para criação do sistema de alertas

-- ========================================
-- ENUMS
-- ========================================

-- Criar enum alert_severity
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
    CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
END $$;

-- Criar enum alert_state
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_state') THEN
    CREATE TYPE alert_state AS ENUM ('open', 'dismissed', 'snoozed', 'resolved');
  END IF;
END $$;

-- ========================================
-- TABELA: alerts
-- ========================================

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_id uuid NULL REFERENCES public.entities(id) ON DELETE SET NULL,
  account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'warning',
  state alert_state NOT NULL DEFAULT 'open',
  title text NOT NULL,
  message text NOT NULL,
  fingerprint text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  snoozed_until timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========================================
-- ÍNDICES E CONSTRAINTS
-- ========================================

-- Unique constraint para deduplicação: (workspace_id, fingerprint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_workspace_fingerprint 
  ON public.alerts(workspace_id, fingerprint);

-- Índice para filtros comuns: (workspace_id, state, severity)
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_state_severity 
  ON public.alerts(workspace_id, state, severity);

-- Índice para filtro por entidade: (workspace_id, entity_id)
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_entity 
  ON public.alerts(workspace_id, entity_id) 
  WHERE entity_id IS NOT NULL;

-- Índice para ordenação por data: (workspace_id, last_seen_at desc)
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_last_seen 
  ON public.alerts(workspace_id, last_seen_at DESC);

-- ========================================
-- RLS
-- ========================================

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "alerts_select_for_members" ON public.alerts;
CREATE POLICY "alerts_select_for_members"
  ON public.alerts
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Apenas membros do workspace (pode ser sistema ou usuário)
DROP POLICY IF EXISTS "alerts_insert_for_members" ON public.alerts;
CREATE POLICY "alerts_insert_for_members"
  ON public.alerts
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Apenas membros do workspace (permitir alterar state/dismiss/snooze)
DROP POLICY IF EXISTS "alerts_update_for_members" ON public.alerts;
CREATE POLICY "alerts_update_for_members"
  ON public.alerts
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ========================================
-- COMENTÁRIOS
-- ========================================

COMMENT ON TABLE public.alerts IS 'Sistema de alertas inteligentes com deduplicação por fingerprint';
COMMENT ON COLUMN public.alerts.fingerprint IS 'Hash único para deduplicação: tipo:entidade:conta:período';
COMMENT ON COLUMN public.alerts.context IS 'Dados JSON para drilldown: datas, amounts, schedule_ids, link hints';
COMMENT ON COLUMN public.alerts.last_seen_at IS 'Última vez que o alerta foi visto (atualizado a cada avaliação)';
COMMENT ON COLUMN public.alerts.snoozed_until IS 'Data até quando o alerta está pausado (se state=snoozed)';



-- ========== 20250101_000001_mc10_pluggy_source_fields.sql ==========
-- MC10: Adicionar suporte a source e external_id nas tabelas accounts e transactions
-- Para permitir ingestão de dados do Pluggy e outros agregadores

-- Adicionar colunas em accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Adicionar colunas em transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_accounts_source ON public.accounts(source) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_external_id ON public.accounts(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_source ON public.transactions(source) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON public.transactions(external_id) WHERE external_id IS NOT NULL;

-- Constraint: se external_id existe, source deve existir
ALTER TABLE public.accounts
DROP CONSTRAINT IF EXISTS accounts_external_id_requires_source;

ALTER TABLE public.accounts
ADD CONSTRAINT accounts_external_id_requires_source
CHECK ((external_id IS NULL) OR (source IS NOT NULL));

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_external_id_requires_source;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_external_id_requires_source
CHECK ((external_id IS NULL) OR (source IS NOT NULL));



-- ========== 20250101_000002_mc10_unique_constraints.sql ==========
-- MC10: Adicionar constraints UNIQUE para evitar duplicação de accounts/transactions do Pluggy
-- NOTA: Esta migration assume que as colunas source e external_id já existem (criadas em 20250101_000001)

-- Garantir que as colunas existam (caso a migration anterior não tenha sido executada)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Constraint UNIQUE para accounts (entity_id, source, external_id)
DROP INDEX IF EXISTS accounts_unique_external;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_unique_external 
ON public.accounts(entity_id, source, external_id) 
WHERE source IS NOT NULL AND external_id IS NOT NULL;

-- Constraint UNIQUE para transactions (entity_id, source, external_id)
DROP INDEX IF EXISTS transactions_unique_external;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_unique_external 
ON public.transactions(entity_id, source, external_id) 
WHERE source IS NOT NULL AND external_id IS NOT NULL;



-- ========== 20250101_000003_mc10_connections_unique.sql ==========
-- MC10: Impedir conexões duplicadas do Pluggy
-- UNIQUE INDEX em connections para garantir idempotência

DROP INDEX IF EXISTS connections_unique_pluggy;

CREATE UNIQUE INDEX connections_unique_pluggy 
ON public.connections(workspace_id, entity_id, provider_id, external_connection_id) 
WHERE external_connection_id IS NOT NULL;



-- ========== 20250101_000004_mc10_cleanup_duplicates.sql ==========
-- MC10: Script para limpar conexões duplicadas do Pluggy
-- Mantém apenas 1 conexão por (entity_id, provider_id, external_connection_id)
-- Marca duplicadas como status='revoked' (não deleta para manter histórico)

-- Identificar duplicatas (manter a mais recente)
WITH duplicates AS (
  SELECT 
    id,
    workspace_id,
    entity_id,
    provider_id,
    external_connection_id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, entity_id, provider_id, external_connection_id 
      ORDER BY created_at DESC
    ) as rn
  FROM public.connections
  WHERE external_connection_id IS NOT NULL
    AND provider_id IN (
      SELECT p.id 
      FROM public.providers p
      JOIN public.provider_catalog pc ON pc.id = p.catalog_id
      WHERE pc.code = 'pluggy'
    )
)
UPDATE public.connections
SET 
  status = 'revoked',
  updated_at = now(),
  last_error = 'Marcada como duplicada durante limpeza'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Comentário: Se quiser deletar completamente (não recomendado para manter histórico):
-- DELETE FROM public.connections WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);



-- ========== 20250102_000001_mc11_cashflow_cards.sql ==========
-- MC11: Incluir card_installments no fluxo de caixa mensal
-- Atualiza função get_monthly_cashflow_matrix para incluir parcelas de cartão

CREATE OR REPLACE FUNCTION public.get_monthly_cashflow_matrix(
  p_workspace_id uuid,
  p_from_month date,
  p_to_month date,
  p_entity_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_user_id uuid;
BEGIN
  -- Validar que o usuário pertence ao workspace
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: workspace não encontrado ou sem permissão';
  END IF;
  
  -- Validar intervalo
  IF p_from_month > p_to_month THEN
    RAISE EXCEPTION 'Data inicial deve ser menor ou igual à data final';
  END IF;
  
  -- Gerar série mensal e calcular agregações
  WITH month_series AS (
    SELECT 
      generate_series(
        date_trunc('month', p_from_month),
        date_trunc('month', p_to_month),
        '1 month'::interval
      )::date AS month_start
  ),
  -- Previsto: schedules PLANNED (não cancelled, sem linked_transaction)
  planned_data AS (
    SELECT 
      date_trunc('month', fs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN fc.type = 'revenue' THEN fs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN fc.type = 'expense' THEN fs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.financial_schedules fs
    INNER JOIN public.financial_commitments fc ON fs.commitment_id = fc.id
    WHERE fs.workspace_id = p_workspace_id
      AND fs.status = 'planned'
      AND fs.linked_transaction_id IS NULL
      AND fs.deleted_at IS NULL
      AND fc.deleted_at IS NULL
      AND date_trunc('month', fs.due_date)::date >= p_from_month
      AND date_trunc('month', fs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR fc.entity_id = p_entity_id)
    GROUP BY date_trunc('month', fs.due_date)::date
    
    UNION ALL
    
    -- Contract schedules PLANNED
    SELECT 
      date_trunc('month', cs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN cs.type = 'receivable' THEN cs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN cs.type = 'payable' THEN cs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.contract_schedules cs
    INNER JOIN public.contracts c ON cs.contract_id = c.id
    WHERE cs.workspace_id = p_workspace_id
      AND cs.status = 'planned'
      AND cs.linked_transaction_id IS NULL
      AND cs.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND date_trunc('month', cs.due_date)::date >= p_from_month
      AND date_trunc('month', cs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR c.counterparty_entity_id = p_entity_id)
    GROUP BY date_trunc('month', cs.due_date)::date
    
    UNION ALL
    
    -- Card installments PLANNED (scheduled, não posted)
    -- Calcular data de pagamento: competence_month + due_day do cartão
    -- due_date = primeiro dia do competence_month + due_day - 1 (garantindo que não exceda último dia do mês)
    SELECT 
      date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::date) - 1)
        )
      )::date AS month_start,
      0 AS planned_income, -- Cartões são sempre despesas
      SUM(ci.amount) AS planned_expense
    FROM public.card_installments ci
    INNER JOIN public.cards c ON ci.card_id = c.id
    WHERE ci.workspace_id = p_workspace_id
      AND ci.status = 'scheduled'
      AND ci.posted_transaction_id IS NULL
      -- Filtrar por mês de pagamento calculado
      AND date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::date) - 1)
        )
      )::date >= p_from_month
      AND date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::date) - 1)
        )
      )::date <= p_to_month
      AND (p_entity_id IS NULL OR ci.entity_id = p_entity_id)
    GROUP BY date_trunc('month', 
      (date_trunc('month', ci.competence_month)::date + 
       (LEAST(c.due_day, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::date) - 1)
      )
    )::date
  ),
  planned_agg AS (
    SELECT 
      month_start,
      COALESCE(SUM(planned_income), 0) AS planned_income,
      COALESCE(SUM(planned_expense), 0) AS planned_expense
    FROM planned_data
    GROUP BY month_start
  ),
  -- Realizado: transactions (não reversed)
  -- Inclui transações vinculadas a card_installments (posted)
  realised_data AS (
    SELECT 
      date_trunc('month', t.date)::date AS month_start,
      SUM(CASE 
        WHEN t.type = 'income' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_income,
      SUM(CASE 
        WHEN t.type = 'expense' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_expense
    FROM public.transactions t
    WHERE t.workspace_id = p_workspace_id
      AND t.reversed_by_id IS NULL
      AND date_trunc('month', t.date)::date >= p_from_month
      AND date_trunc('month', t.date)::date <= p_to_month
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
    GROUP BY date_trunc('month', t.date)::date
  ),
  -- Combinar meses e calcular acumulado
  monthly_data AS (
    SELECT 
      ms.month_start,
      COALESCE(pa.planned_income, 0) AS planned_income,
      COALESCE(pa.planned_expense, 0) AS planned_expense,
      COALESCE(rd.realised_income, 0) AS realised_income,
      COALESCE(rd.realised_expense, 0) AS realised_expense,
      COALESCE(pa.planned_income, 0) - COALESCE(pa.planned_expense, 0) AS planned_net,
      COALESCE(rd.realised_income, 0) - COALESCE(rd.realised_expense, 0) AS realised_net
    FROM month_series ms
    LEFT JOIN planned_agg pa ON ms.month_start = pa.month_start
    LEFT JOIN realised_data rd ON ms.month_start = rd.month_start
    ORDER BY ms.month_start
  ),
  -- Calcular acumulado
  with_cumulative AS (
    SELECT 
      month_start,
      planned_income,
      planned_expense,
      planned_net,
      realised_income,
      realised_expense,
      realised_net,
      SUM(planned_net) OVER (ORDER BY month_start) AS planned_cum,
      SUM(realised_net) OVER (ORDER BY month_start) AS realised_cum
    FROM monthly_data
  ),
  -- Calcular worst balance por mês (determinístico)
  with_worst_balance AS (
    SELECT 
      month_start,
      planned_cum,
      realised_cum,
      LEAST(planned_cum, realised_cum) AS worst_balance
    FROM with_cumulative
  ),
  -- Encontrar mínimo balance e primeiro mês que atinge (determinístico)
  min_cum AS (
    SELECT 
      MIN(worst_balance) AS min_cum_balance
    FROM with_worst_balance
  ),
  min_cum_month_row AS (
    SELECT 
      month_start AS min_cum_month
    FROM with_worst_balance, min_cum
    WHERE worst_balance = min_cum.min_cum_balance
    ORDER BY month_start
    LIMIT 1
  )
  SELECT json_build_object(
    'months', json_agg(
      json_build_object(
        'month_start', month_start,
        'planned_income', planned_income,
        'planned_expense', planned_expense,
        'planned_net', planned_net,
        'realised_income', realised_income,
        'realised_expense', realised_expense,
        'realised_net', realised_net,
        'planned_cum', planned_cum,
        'realised_cum', realised_cum
      ) ORDER BY month_start
    ),
    'metadata', (
      SELECT json_build_object(
        'min_cum_balance', mc.min_cum_balance,
        'min_cum_month', mcm.min_cum_month
      )
      FROM min_cum mc
      LEFT JOIN LATERAL (
        SELECT min_cum_month FROM min_cum_month_row LIMIT 1
      ) mcm ON TRUE
    )
  ) INTO v_result
  FROM with_cumulative;
  
  RETURN COALESCE(v_result, '{"months": [], "metadata": {"min_cum_balance": null, "min_cum_month": null}}'::json);
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.get_monthly_cashflow_matrix IS 'Retorna matriz mensal de fluxo de caixa (previsto vs realizado) incluindo card_installments com RLS aplicado';



-- ========== 20250103_000001_mc13_scrapers.sql ==========
-- MC13: Sistema de Scraping Bancário
-- Tabela para armazenar conexões de scrapers

CREATE TABLE IF NOT EXISTS public.scraper_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL CHECK (bank_code IN ('itau', 'santander', 'btg', 'mercadopago')),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  credentials_encrypted TEXT NOT NULL, -- JSON criptografado com credenciais
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'pending')),
  last_sync_error TEXT,
  schedule_frequency TEXT CHECK (schedule_frequency IN ('daily', 'weekly', 'monthly')),
  schedule_time TIME, -- HH:mm
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Uma conexão por banco/entidade
  UNIQUE(workspace_id, bank_code, entity_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_scraper_connections_workspace_id 
  ON public.scraper_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scraper_connections_entity_id 
  ON public.scraper_connections(entity_id);
CREATE INDEX IF NOT EXISTS idx_scraper_connections_bank_code 
  ON public.scraper_connections(bank_code);
CREATE INDEX IF NOT EXISTS idx_scraper_connections_is_active 
  ON public.scraper_connections(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.scraper_connections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY scraper_connections_select_for_members
  ON public.scraper_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = scraper_connections.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY scraper_connections_insert_for_members
  ON public.scraper_connections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = scraper_connections.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY scraper_connections_update_for_members
  ON public.scraper_connections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = scraper_connections.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY scraper_connections_delete_for_members
  ON public.scraper_connections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = scraper_connections.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Tabela de logs de scraping
CREATE TABLE IF NOT EXISTS public.scraper_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.scraper_connections(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  transactions_found INTEGER DEFAULT 0,
  transactions_imported INTEGER DEFAULT 0,
  transactions_skipped INTEGER DEFAULT 0,
  reconciliations INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_scraper_sync_logs_workspace_id 
  ON public.scraper_sync_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scraper_sync_logs_connection_id 
  ON public.scraper_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_scraper_sync_logs_created_at 
  ON public.scraper_sync_logs(created_at DESC);

-- RLS para logs
ALTER TABLE public.scraper_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scraper_sync_logs_select_for_members
  ON public.scraper_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = scraper_sync_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_scraper_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scraper_connections_updated_at
  BEFORE UPDATE ON public.scraper_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_scraper_connections_updated_at();



-- ========== 20250124_000001_mc14_debit_notes.sql ==========
-- MC14: Notas de Débito - Estrutura Base
-- Migration idempotente para criação do schema de notas de débito

-- ========================================
-- ADICIONAR CAMPOS DE REAJUSTE EM CONTRATOS
-- ========================================

-- Adicionar campos de índice de reajuste em contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS adjustment_index text CHECK (adjustment_index IN ('NONE', 'IPCA', 'IGPM', 'CDI', 'MANUAL', 'CUSTOM')),
  ADD COLUMN IF NOT EXISTS adjustment_frequency text CHECK (adjustment_frequency IN ('NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  ADD COLUMN IF NOT EXISTS adjustment_percentage numeric(5,4), -- Para MANUAL ou CUSTOM (ex: 0.045 para 4,5%)
  ADD COLUMN IF NOT EXISTS last_adjustment_date date;

-- Índice para buscar contratos que precisam de reajuste
CREATE INDEX IF NOT EXISTS idx_contracts_adjustment_date 
  ON public.contracts(last_adjustment_date) 
  WHERE adjustment_index IS NOT NULL AND adjustment_index != 'NONE';

-- Atualizar valores padrão para contratos existentes
UPDATE public.contracts
  SET adjustment_index = 'NONE',
      adjustment_frequency = 'NONE'
  WHERE adjustment_index IS NULL;

-- ========================================
-- DEBIT_NOTES (Notas de Débito)
-- ========================================

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  
  -- Numeração
  number text NOT NULL, -- Ex: "ND-2025-001"
  sequence_number integer NOT NULL, -- 001, 002, etc. (para ordenação)
  
  -- Datas
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  paid_at date, -- Data do pagamento (preenchido na reconciliação)
  
  -- Valores
  total_amount numeric(15,2) NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  
  -- Descrição geral
  description text, -- Ex: "Fatura mensal - jan/2025"
  
  -- Vinculação ao pagamento
  linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(workspace_id, number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debit_notes_workspace_id ON public.debit_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_contract_id ON public.debit_notes(contract_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_status ON public.debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_debit_notes_due_date ON public.debit_notes(due_date);
CREATE INDEX IF NOT EXISTS idx_debit_notes_issued_date ON public.debit_notes(issued_date);
CREATE INDEX IF NOT EXISTS idx_debit_notes_number ON public.debit_notes(workspace_id, number);
CREATE INDEX IF NOT EXISTS idx_debit_notes_linked_transaction_id ON public.debit_notes(linked_transaction_id);

-- ========================================
-- DEBIT_NOTE_ITEMS (Itens da Nota de Débito)
-- ========================================

CREATE TABLE IF NOT EXISTS public.debit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  debit_note_id uuid NOT NULL REFERENCES public.debit_notes(id) ON DELETE CASCADE,
  contract_schedule_id uuid NOT NULL REFERENCES public.contract_schedules(id) ON DELETE CASCADE,
  
  -- Valores
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  
  -- Descrição do item
  description text, -- Ex: "Locação - jan/2025"
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(debit_note_id, contract_schedule_id) -- Um schedule só pode aparecer uma vez por nota
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debit_note_items_workspace_id ON public.debit_note_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debit_note_items_debit_note_id ON public.debit_note_items(debit_note_id);
CREATE INDEX IF NOT EXISTS idx_debit_note_items_contract_schedule_id ON public.debit_note_items(contract_schedule_id);

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debit_note_items ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - DEBIT_NOTES
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_select_for_members'
  ) THEN
    DROP POLICY debit_notes_select_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_select_for_members
    ON public.debit_notes
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_insert_for_members'
  ) THEN
    DROP POLICY debit_notes_insert_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_insert_for_members
    ON public.debit_notes
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND contract_id IN (
            SELECT id
            FROM public.contracts
            WHERE workspace_id = debit_notes.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_update_for_members'
  ) THEN
    DROP POLICY debit_notes_update_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_update_for_members
    ON public.debit_notes
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_delete_for_members'
  ) THEN
    DROP POLICY debit_notes_delete_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_delete_for_members
    ON public.debit_notes
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - DEBIT_NOTE_ITEMS
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_select_for_members'
  ) THEN
    DROP POLICY debit_note_items_select_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_select_for_members
    ON public.debit_note_items
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_insert_for_members'
  ) THEN
    DROP POLICY debit_note_items_insert_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_insert_for_members
    ON public.debit_note_items
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND debit_note_id IN (
            SELECT id
            FROM public.debit_notes
            WHERE workspace_id = debit_note_items.workspace_id
        )
        AND contract_schedule_id IN (
            SELECT id
            FROM public.contract_schedules
            WHERE workspace_id = debit_note_items.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_update_for_members'
  ) THEN
    DROP POLICY debit_note_items_update_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_update_for_members
    ON public.debit_note_items
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_delete_for_members'
  ) THEN
    DROP POLICY debit_note_items_delete_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_delete_for_members
    ON public.debit_note_items
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );


-- ========== 20250125_000001_hotfix_cashflow_numeric_to_date.sql ==========
-- HOTFIX: Corrigir erro "cannot cast type numeric to date" na função get_monthly_cashflow_matrix
-- O problema estava no cálculo da data de pagamento dos card_installments
-- EXTRACT(DAY FROM ...) retorna double precision, que precisa ser convertido para integer antes de somar com date

CREATE OR REPLACE FUNCTION public.get_monthly_cashflow_matrix(
  p_workspace_id uuid,
  p_from_month date,
  p_to_month date,
  p_entity_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_user_id uuid;
BEGIN
  -- Validar que o usuário pertence ao workspace
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: workspace não encontrado ou sem permissão';
  END IF;
  
  -- Validar intervalo
  IF p_from_month > p_to_month THEN
    RAISE EXCEPTION 'Data inicial deve ser menor ou igual à data final';
  END IF;
  
  -- Gerar série mensal e calcular agregações
  WITH month_series AS (
    SELECT 
      generate_series(
        date_trunc('month', p_from_month),
        date_trunc('month', p_to_month),
        '1 month'::interval
      )::date AS month_start
  ),
  -- Previsto: schedules PLANNED (não cancelled, sem linked_transaction)
  planned_data AS (
    SELECT 
      date_trunc('month', fs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN fc.type = 'revenue' THEN fs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN fc.type = 'expense' THEN fs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.financial_schedules fs
    INNER JOIN public.financial_commitments fc ON fs.commitment_id = fc.id
    WHERE fs.workspace_id = p_workspace_id
      AND fs.status = 'planned'
      AND fs.linked_transaction_id IS NULL
      AND fs.deleted_at IS NULL
      AND fc.deleted_at IS NULL
      AND date_trunc('month', fs.due_date)::date >= p_from_month
      AND date_trunc('month', fs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR fc.entity_id = p_entity_id)
    GROUP BY date_trunc('month', fs.due_date)::date
    
    UNION ALL
    
    -- Contract schedules PLANNED
    SELECT 
      date_trunc('month', cs.due_date)::date AS month_start,
      SUM(CASE 
        WHEN cs.type = 'receivable' THEN cs.amount 
        ELSE 0 
      END) AS planned_income,
      SUM(CASE 
        WHEN cs.type = 'payable' THEN cs.amount 
        ELSE 0 
      END) AS planned_expense
    FROM public.contract_schedules cs
    INNER JOIN public.contracts c ON cs.contract_id = c.id
    WHERE cs.workspace_id = p_workspace_id
      AND cs.status = 'planned'
      AND cs.linked_transaction_id IS NULL
      AND cs.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND date_trunc('month', cs.due_date)::date >= p_from_month
      AND date_trunc('month', cs.due_date)::date <= p_to_month
      AND (p_entity_id IS NULL OR c.counterparty_entity_id = p_entity_id)
    GROUP BY date_trunc('month', cs.due_date)::date
    
    UNION ALL
    
    -- Card installments PLANNED (scheduled, não posted)
    -- FIX: Converter EXTRACT(DAY FROM ...) para integer antes de somar com date
    SELECT 
      date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
        )
      )::date AS month_start,
      0 AS planned_income, -- Cartões são sempre despesas
      SUM(ci.amount) AS planned_expense
    FROM public.card_installments ci
    INNER JOIN public.cards c ON ci.card_id = c.id
    WHERE ci.workspace_id = p_workspace_id
      AND ci.status = 'scheduled'
      AND ci.posted_transaction_id IS NULL
      -- Filtrar por mês de pagamento calculado
      AND date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
        )
      )::date >= p_from_month
      AND date_trunc('month', 
        (date_trunc('month', ci.competence_month)::date + 
         (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
        )
      )::date <= p_to_month
      AND (p_entity_id IS NULL OR ci.entity_id = p_entity_id)
    GROUP BY date_trunc('month', 
      (date_trunc('month', ci.competence_month)::date + 
       (LEAST(c.due_day::integer, EXTRACT(DAY FROM (date_trunc('month', ci.competence_month) + INTERVAL '1 month' - INTERVAL '1 day'))::integer) - 1)
      )
    )::date
  ),
  planned_agg AS (
    SELECT 
      month_start,
      COALESCE(SUM(planned_income), 0) AS planned_income,
      COALESCE(SUM(planned_expense), 0) AS planned_expense
    FROM planned_data
    GROUP BY month_start
  ),
  -- Realizado: transactions (não reversed)
  -- Inclui transações vinculadas a card_installments (posted)
  realised_data AS (
    SELECT 
      date_trunc('month', t.date)::date AS month_start,
      SUM(CASE 
        WHEN t.type = 'income' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_income,
      SUM(CASE 
        WHEN t.type = 'expense' THEN ABS(t.amount)
        ELSE 0 
      END) AS realised_expense
    FROM public.transactions t
    WHERE t.workspace_id = p_workspace_id
      AND t.reversed_by_id IS NULL
      AND date_trunc('month', t.date)::date >= p_from_month
      AND date_trunc('month', t.date)::date <= p_to_month
      AND (p_entity_id IS NULL OR t.entity_id = p_entity_id)
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
    GROUP BY date_trunc('month', t.date)::date
  ),
  -- Combinar meses e calcular acumulado
  monthly_data AS (
    SELECT 
      ms.month_start,
      COALESCE(pa.planned_income, 0) AS planned_income,
      COALESCE(pa.planned_expense, 0) AS planned_expense,
      COALESCE(rd.realised_income, 0) AS realised_income,
      COALESCE(rd.realised_expense, 0) AS realised_expense,
      COALESCE(pa.planned_income, 0) - COALESCE(pa.planned_expense, 0) AS planned_net,
      COALESCE(rd.realised_income, 0) - COALESCE(rd.realised_expense, 0) AS realised_net
    FROM month_series ms
    LEFT JOIN planned_agg pa ON ms.month_start = pa.month_start
    LEFT JOIN realised_data rd ON ms.month_start = rd.month_start
    ORDER BY ms.month_start
  ),
  -- Calcular acumulado
  with_cumulative AS (
    SELECT 
      month_start,
      planned_income,
      planned_expense,
      planned_net,
      realised_income,
      realised_expense,
      realised_net,
      SUM(planned_net) OVER (ORDER BY month_start) AS planned_cum,
      SUM(realised_net) OVER (ORDER BY month_start) AS realised_cum
    FROM monthly_data
  ),
  -- Calcular worst balance por mês (determinístico)
  with_worst_balance AS (
    SELECT 
      month_start,
      planned_cum,
      realised_cum,
      LEAST(planned_cum, realised_cum) AS worst_balance
    FROM with_cumulative
  ),
  -- Encontrar mínimo balance e primeiro mês que atinge (determinístico)
  min_cum AS (
    SELECT 
      MIN(worst_balance) AS min_cum_balance
    FROM with_worst_balance
  ),
  min_cum_month_row AS (
    SELECT 
      month_start AS min_cum_month
    FROM with_worst_balance, min_cum
    WHERE worst_balance = min_cum.min_cum_balance
    ORDER BY month_start
    LIMIT 1
  )
  SELECT json_build_object(
    'months', json_agg(
      json_build_object(
        'month_start', month_start,
        'planned_income', planned_income,
        'planned_expense', planned_expense,
        'planned_net', planned_net,
        'realised_income', realised_income,
        'realised_expense', realised_expense,
        'realised_net', realised_net,
        'planned_cum', planned_cum,
        'realised_cum', realised_cum
      ) ORDER BY month_start
    ),
    'metadata', (
      SELECT json_build_object(
        'min_cum_balance', mc.min_cum_balance,
        'min_cum_month', mcm.min_cum_month
      )
      FROM min_cum mc
      LEFT JOIN LATERAL (
        SELECT min_cum_month FROM min_cum_month_row LIMIT 1
      ) mcm ON TRUE
    )
  ) INTO v_result
  FROM with_cumulative;
  
  RETURN COALESCE(v_result, '{"months": [], "metadata": {"min_cum_balance": null, "min_cum_month": null}}'::json);
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.get_monthly_cashflow_matrix IS 'Retorna matriz mensal de fluxo de caixa (previsto vs realizado) incluindo card_installments com RLS aplicado. HOTFIX: corrigido cast de numeric para date';


-- ========== 20250125_000002_contracts_improvements.sql ==========
-- MC15: Melhorias em Contratos
-- Adiciona deleted_at para soft delete e ajusta campos de reajuste

-- Adicionar deleted_at se não existir
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Adicionar campos de valor e recorrência se não existirem
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS value_type text CHECK (value_type IN ('total', 'monthly', 'quarterly', 'yearly')) DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS monthly_value numeric(15,2),
  ADD COLUMN IF NOT EXISTS recurrence_period text CHECK (recurrence_period IN ('monthly', 'quarterly', 'yearly')) DEFAULT 'monthly';

-- Índice para filtrar contratos não deletados
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON public.contracts(deleted_at) WHERE deleted_at IS NULL;

-- Comentários
COMMENT ON COLUMN public.contracts.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado';
COMMENT ON COLUMN public.contracts.value_type IS 'Tipo de valor: total (valor total do contrato) ou mensal/trimestral/anual';
COMMENT ON COLUMN public.contracts.monthly_value IS 'Valor mensal (usado quando value_type = monthly)';
COMMENT ON COLUMN public.contracts.recurrence_period IS 'Período de recorrência dos schedules (mensal, trimestral, anual)';


-- ========== 20250125_000003_fix_contract_schedules_deleted_at.sql ==========
-- HOTFIX: Adicionar deleted_at em contract_schedules e garantir que schedules sejam excluídos quando contrato for deletado

-- Adicionar deleted_at em contract_schedules se não existir
ALTER TABLE public.contract_schedules
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Índice para filtrar schedules não deletados
CREATE INDEX IF NOT EXISTS idx_contract_schedules_deleted_at ON public.contract_schedules(deleted_at) WHERE deleted_at IS NULL;

-- Comentário
COMMENT ON COLUMN public.contract_schedules.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado. Schedules são automaticamente marcados como deletados quando o contrato é deletado.';

-- Trigger function para marcar schedules como deletados quando contrato for deletado (soft delete)
CREATE OR REPLACE FUNCTION public.mark_contract_schedules_as_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o contrato foi deletado (deleted_at não é NULL), marcar todos os schedules também
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.contract_schedules
    SET deleted_at = NEW.deleted_at
    WHERE contract_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando contrato for atualizado
DROP TRIGGER IF EXISTS trigger_mark_schedules_deleted_on_contract_delete ON public.contracts;
CREATE TRIGGER trigger_mark_schedules_deleted_on_contract_delete
  AFTER UPDATE OF deleted_at ON public.contracts
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL))
  EXECUTE FUNCTION public.mark_contract_schedules_as_deleted();

-- Atualizar schedules existentes de contratos já deletados
UPDATE public.contract_schedules cs
SET deleted_at = c.deleted_at
FROM public.contracts c
WHERE cs.contract_id = c.id
  AND c.deleted_at IS NOT NULL
  AND cs.deleted_at IS NULL;


-- ========== 20250125_000004_contract_line_items.sql ==========
-- MC15: Contract Line Items (Despesas/Descontos)
-- Migration para adicionar suporte a itens de linha (despesas/descontos) em contratos e notas de débito

-- ========================================
-- CONTRACT_LINE_ITEMS (Itens de linha de contratos)
-- ========================================
CREATE TABLE IF NOT EXISTS public.contract_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('expense', 'discount')),
    description text,
    amount numeric(15,2) NOT NULL CHECK (amount != 0),
    item_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_line_items_contract_id ON public.contract_line_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_line_items_workspace_id ON public.contract_line_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_line_items_type ON public.contract_line_items(type);
CREATE INDEX IF NOT EXISTS idx_contract_line_items_item_order ON public.contract_line_items(contract_id, item_order);

-- ========================================
-- Atualizar DEBIT_NOTE_ITEMS para suportar itens adicionais
-- ========================================
-- Adicionar campos opcionais para descrição e tipo
ALTER TABLE public.debit_note_items
  ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('expense', 'discount')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS item_order integer NOT NULL DEFAULT 0;

-- Índice para ordenação
CREATE INDEX IF NOT EXISTS idx_debit_note_items_item_order ON public.debit_note_items(debit_note_id, item_order);

-- Comentários
COMMENT ON TABLE public.contract_line_items IS 'Itens de linha (despesas/descontos) associados a contratos';
COMMENT ON COLUMN public.contract_line_items.type IS 'Tipo do item: expense (despesa) ou discount (desconto/crédito/isenção)';
COMMENT ON COLUMN public.contract_line_items.amount IS 'Valor do item (positivo para despesas, negativo para descontos)';
COMMENT ON COLUMN public.contract_line_items.item_order IS 'Ordem de exibição do item dentro do contrato';
COMMENT ON COLUMN public.debit_note_items.type IS 'Tipo do item: expense (despesa) ou discount (desconto/crédito/isenção). NULL = item do schedule';
COMMENT ON COLUMN public.debit_note_items.item_order IS 'Ordem de exibição do item dentro da nota de débito';

-- ========================================
-- RLS - Habilitar
-- ========================================
ALTER TABLE public.contract_line_items ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - CONTRACT_LINE_ITEMS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_select_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_select_for_members"
    ON public.contract_line_items
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_insert_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_insert_for_members"
    ON public.contract_line_items
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND contract_id IN (
            SELECT id
            FROM public.contracts
            WHERE workspace_id = contract_line_items.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_update_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_update_for_members"
    ON public.contract_line_items
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_delete_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_delete_for_members"
    ON public.contract_line_items
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_contract_line_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_contract_line_items_updated_at ON public.contract_line_items;
CREATE TRIGGER trigger_update_contract_line_items_updated_at
    BEFORE UPDATE ON public.contract_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_contract_line_items_updated_at();


-- ========== 20250125_000005_fix_debit_note_items_nullable.sql ==========
-- MC15: Fix para permitir contract_schedule_id NULL em debit_note_items
-- Permitir items adicionais (expenses/discounts) que não são vinculados a schedules

ALTER TABLE public.debit_note_items
  ALTER COLUMN contract_schedule_id DROP NOT NULL;

COMMENT ON COLUMN public.debit_note_items.contract_schedule_id IS 'ID do schedule vinculado. NULL = item adicional (expense/discount) não vinculado a schedule';


-- ========== 20250126_000001_accounts_soft_delete.sql ==========
-- HOTFIX: Adicionar deleted_at em accounts para soft delete
-- Migration idempotente

-- Adicionar deleted_at em accounts se não existir
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Criar índice para performance em queries que filtram deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON public.accounts(deleted_at) WHERE deleted_at IS NULL;

-- Comentário na coluna
COMMENT ON COLUMN public.accounts.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado';


-- ========== 20250126_000002_fix_debit_note_items_rls.sql ==========
-- MC14: Fix RLS Policy for debit_note_items to allow NULL contract_schedule_id
-- Permite inserir items adicionais (expenses/discounts) sem contract_schedule_id

-- Remover política antiga
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_insert_for_members'
  ) THEN
    DROP POLICY debit_note_items_insert_for_members ON public.debit_note_items;
  END IF;
END
$$;

-- Criar nova política que permite contract_schedule_id NULL
CREATE POLICY debit_note_items_insert_for_members
    ON public.debit_note_items
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND debit_note_id IN (
            SELECT id
            FROM public.debit_notes
            WHERE workspace_id = debit_note_items.workspace_id
        )
        AND (
            -- Permite contract_schedule_id NULL (para expenses/discounts)
            contract_schedule_id IS NULL
            OR
            -- Ou permite contract_schedule_id válido (para schedules)
            contract_schedule_id IN (
                SELECT id
                FROM public.contract_schedules
                WHERE workspace_id = debit_note_items.workspace_id
            )
        )
    );

COMMENT ON POLICY debit_note_items_insert_for_members ON public.debit_note_items IS 
'Permite inserir items de nota de débito. contract_schedule_id pode ser NULL para expenses/discounts ou válido para schedules vinculados.';


-- ========== 20250126_000003_debit_notes_soft_delete.sql ==========
-- MC14: Adicionar soft delete em debit_notes
-- Adicionar deleted_at em public.debit_notes se não existir

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.debit_notes ADD COLUMN deleted_at timestamptz;
    END IF;
END $$;

-- Criar índice para performance em consultas que filtram por deleted_at
CREATE INDEX IF NOT EXISTS idx_debit_notes_deleted_at ON public.debit_notes(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.debit_notes.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado.';


-- ========== 20250126_000004_debit_notes_client_notes.sql ==========
-- MC_DEBIT_NOTES_CLIENT_NOTES: Adicionar campos client_name e notes em debit_notes

-- Adicionar client_name (nome do cliente para preenchimento manual)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'debit_notes' AND column_name = 'client_name') THEN
        ALTER TABLE public.debit_notes ADD COLUMN client_name text;
        RAISE NOTICE 'Coluna client_name adicionada em debit_notes';
    ELSE
        RAISE NOTICE 'Coluna client_name já existe em debit_notes';
    END IF;
END $$;

-- Adicionar notes (observações: informações de depósito/PIX, informações pertinentes ao contrato)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'debit_notes' AND column_name = 'notes') THEN
        ALTER TABLE public.debit_notes ADD COLUMN notes text;
        RAISE NOTICE 'Coluna notes adicionada em debit_notes';
    ELSE
        RAISE NOTICE 'Coluna notes já existe em debit_notes';
    END IF;
END $$;

COMMENT ON COLUMN public.debit_notes.client_name IS 'Nome do cliente (preenchimento manual)';
COMMENT ON COLUMN public.debit_notes.notes IS 'Observações: informações de depósito/PIX, informações pertinentes ao contrato';


-- ========== 20250126_000005_debit_note_items_commitment_ref.sql ==========
-- MC14: Adicionar referência a financial_commitments em debit_note_items
-- Permite rastrear compromissos financeiros criados a partir de despesas das notas de débito

-- Adicionar financial_commitment_id em debit_note_items se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'debit_note_items' 
          AND column_name = 'financial_commitment_id'
    ) THEN
        ALTER TABLE public.debit_note_items 
        ADD COLUMN financial_commitment_id uuid REFERENCES public.financial_commitments(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Coluna financial_commitment_id adicionada em debit_note_items';
    ELSE
        RAISE NOTICE 'Coluna financial_commitment_id já existe em debit_note_items';
    END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_debit_note_items_financial_commitment_id 
ON public.debit_note_items(financial_commitment_id) 
WHERE financial_commitment_id IS NOT NULL;

COMMENT ON COLUMN public.debit_note_items.financial_commitment_id IS 
'ID do financial_commitment criado a partir desta despesa da nota de débito. NULL = não provisionado ou não é despesa.';


-- ========== FIX_DELETE_VERCEL.sql ==========
-- ========================================
-- FIX COMPLETO PARA DELEÇÃO NO VERCEL
-- Execute este script no Supabase de PRODUÇÃO
-- ========================================

-- 1. Adicionar deleted_at em debit_notes (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.debit_notes ADD COLUMN deleted_at timestamptz;
        RAISE NOTICE 'Coluna deleted_at adicionada em debit_notes';
    ELSE
        RAISE NOTICE 'Coluna deleted_at já existe em debit_notes';
    END IF;
END $$;

-- 2. Criar índice para deleted_at
CREATE INDEX IF NOT EXISTS idx_debit_notes_deleted_at 
ON public.debit_notes(deleted_at) WHERE deleted_at IS NULL;

-- 3. Corrigir RLS Policy para debit_note_items (permitir NULL em contract_schedule_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_insert_for_members'
  ) THEN
    DROP POLICY debit_note_items_insert_for_members ON public.debit_note_items;
    RAISE NOTICE 'Política debit_note_items_insert_for_members removida';
  END IF;
END $$;

CREATE POLICY debit_note_items_insert_for_members
    ON public.debit_note_items
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND debit_note_id IN (
            SELECT id
            FROM public.debit_notes
            WHERE workspace_id = debit_note_items.workspace_id
        )
        AND (
            -- Permite contract_schedule_id NULL (para expenses/discounts)
            contract_schedule_id IS NULL
            OR
            -- Ou permite contract_schedule_id válido (para schedules)
            contract_schedule_id IN (
                SELECT id
                FROM public.contract_schedules
                WHERE workspace_id = debit_note_items.workspace_id
            )
        )
    );

-- 4. Garantir que a política de DELETE existe para debit_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_delete_for_members'
  ) THEN
    CREATE POLICY debit_notes_delete_for_members
        ON public.debit_notes
        FOR DELETE
        USING (
            workspace_id IN (
                SELECT workspace_id
                FROM public.workspace_members
                WHERE user_id = auth.uid()
            )
        );
    RAISE NOTICE 'Política debit_notes_delete_for_members criada';
  ELSE
    RAISE NOTICE 'Política debit_notes_delete_for_members já existe';
  END IF;
END $$;

-- 5. Verificar se a tabela debit_note_items tem a coluna type e item_order
DO $$
BEGIN
    -- Adicionar type se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_note_items' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.debit_note_items ADD COLUMN type text CHECK (type IN ('schedule', 'expense', 'discount'));
        RAISE NOTICE 'Coluna type adicionada em debit_note_items';
    END IF;

    -- Adicionar item_order se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_note_items' 
        AND column_name = 'item_order'
    ) THEN
        ALTER TABLE public.debit_note_items ADD COLUMN item_order integer DEFAULT 0;
        RAISE NOTICE 'Coluna item_order adicionada em debit_note_items';
    END IF;

    -- Tornar contract_schedule_id nullable se ainda não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_note_items' 
        AND column_name = 'contract_schedule_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.debit_note_items ALTER COLUMN contract_schedule_id DROP NOT NULL;
        RAISE NOTICE 'contract_schedule_id tornada nullable em debit_note_items';
    END IF;
END $$;

-- 6. Comentários
COMMENT ON COLUMN public.debit_notes.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado.';
COMMENT ON POLICY debit_note_items_insert_for_members ON public.debit_note_items IS 
'Permite inserir items de nota de débito. contract_schedule_id pode ser NULL para expenses/discounts ou válido para schedules vinculados.';

-- ========================================
-- FIM DO FIX
-- ========================================
-- Verificar se tudo está OK:
SELECT 
    'deleted_at existe?' as check_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) as result
UNION ALL
SELECT 
    'RLS delete policy existe?' as check_name,
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'debit_notes'
          AND policyname = 'debit_notes_delete_for_members'
    ) as result
UNION ALL
SELECT 
    'RLS insert policy permite NULL?' as check_name,
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'debit_note_items'
          AND policyname = 'debit_note_items_insert_for_members'
    ) as result;


