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

