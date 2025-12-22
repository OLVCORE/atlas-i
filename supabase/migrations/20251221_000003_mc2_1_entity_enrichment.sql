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

