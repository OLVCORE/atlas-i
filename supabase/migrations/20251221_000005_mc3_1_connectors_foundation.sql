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

