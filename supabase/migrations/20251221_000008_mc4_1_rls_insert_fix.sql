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

