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

