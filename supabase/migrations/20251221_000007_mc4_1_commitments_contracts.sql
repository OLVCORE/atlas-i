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

