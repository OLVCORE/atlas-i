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

