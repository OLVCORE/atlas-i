-- MC6.2: Account Opening Balance Support
-- Adiciona campos para saldo inicial e data de referência
-- 
-- NOTA: A tabela accounts já possui opening_balance e opening_balance_date
-- Este migration apenas garante que opening_balance_as_of exista (renomeando se necessário)

-- Verificar se opening_balance_date existe e renomear para opening_balance_as_of
DO $$
BEGIN
  -- Se opening_balance_date existe e opening_balance_as_of não existe, renomear
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance_as_of'
  ) THEN
    ALTER TABLE public.accounts
    RENAME COLUMN opening_balance_date TO opening_balance_as_of;
  END IF;

  -- Se opening_balance_as_of não existe (e opening_balance_date também não), criar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance_as_of'
  ) THEN
    ALTER TABLE public.accounts
    ADD COLUMN opening_balance_as_of date;
  END IF;

  -- Garantir que opening_balance existe (já deveria existir, mas garantindo idempotência)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'accounts'
    AND column_name = 'opening_balance'
  ) THEN
    ALTER TABLE public.accounts
    ADD COLUMN opening_balance numeric(15,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Comentários
COMMENT ON COLUMN public.accounts.opening_balance IS 'Saldo inicial da conta em sua data de abertura ou última atualização conhecida';
COMMENT ON COLUMN public.accounts.opening_balance_as_of IS 'Data de referência do saldo inicial (quando foi registrado/atualizado)';

