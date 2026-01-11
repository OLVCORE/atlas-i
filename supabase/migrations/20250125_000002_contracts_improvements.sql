-- MC15: Melhorias em Contratos
-- Adiciona deleted_at para soft delete e ajusta campos de reajuste

-- Adicionar deleted_at se não existir
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Adicionar campos de valor e recorrência se não existirem
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS value_type text CHECK (value_type IN ('total', 'monthly', 'quarterly', 'yearly')) DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS monthly_value numeric(15,2),
  ADD COLUMN IF NOT EXISTS recurrence_period text CHECK (recurrence_period IN ('monthly', 'quarterly', 'yearly')) DEFAULT 'monthly';

-- Índice para filtrar contratos não deletados
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON public.contracts(deleted_at) WHERE deleted_at IS NULL;

-- Comentários
COMMENT ON COLUMN public.contracts.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado';
COMMENT ON COLUMN public.contracts.value_type IS 'Tipo de valor: total (valor total do contrato) ou mensal/trimestral/anual';
COMMENT ON COLUMN public.contracts.monthly_value IS 'Valor mensal (usado quando value_type = monthly)';
COMMENT ON COLUMN public.contracts.recurrence_period IS 'Período de recorrência dos schedules (mensal, trimestral, anual)';
