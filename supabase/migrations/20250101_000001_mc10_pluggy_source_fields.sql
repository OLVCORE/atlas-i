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

