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

