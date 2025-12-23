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

