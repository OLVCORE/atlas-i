-- MC8: Movimentação Operacional Real (Ledger + Baixas + Transferências)
-- Adiciona campos para rastrear origem das transactions (baixas, transferências)

-- Adicionar colunas em transactions (idempotente)
DO $$
BEGIN
  -- Adicionar source_type (enum)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'source_type'
  ) THEN
    -- Criar tipo ENUM se não existir
    DO $$
    BEGIN
      CREATE TYPE transaction_source_type AS ENUM ('manual', 'commitment', 'installment', 'transfer', 'adjustment');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    
    ALTER TABLE public.transactions
    ADD COLUMN source_type transaction_source_type NOT NULL DEFAULT 'manual';
  END IF;

  -- Adicionar source_id (nullable, referencia ao registro de origem)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'source_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN source_id uuid;
  END IF;

  -- Adicionar direction (in | out) - substitui inferência de type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'direction'
  ) THEN
    DO $$
    BEGIN
      CREATE TYPE transaction_direction AS ENUM ('in', 'out');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
    
    -- Preencher direction baseado em type existente
    ALTER TABLE public.transactions
    ADD COLUMN direction transaction_direction;
    
    -- Popular direction com base em type (income = in, expense = out, transfer = depende)
    UPDATE public.transactions
    SET direction = CASE
      WHEN type = 'income' THEN 'in'::transaction_direction
      WHEN type = 'expense' THEN 'out'::transaction_direction
      WHEN type = 'transfer' THEN NULL -- transfer precisa ser tratado caso a caso
      ELSE NULL
    END;
    
    -- Tornar NOT NULL após popular (mas permitir NULL temporariamente para transfer)
    ALTER TABLE public.transactions
    ALTER COLUMN direction DROP NOT NULL;
  END IF;

  -- Adicionar effective_date (data real do caixa, pode ser diferente de date)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN effective_date date;
    
    -- Popular effective_date com date existente
    UPDATE public.transactions
    SET effective_date = date;
  END IF;

  -- Adicionar transfer_group_id (para agrupar transferências)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'transfer_group_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN transfer_group_id uuid;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_source_type ON public.transactions(source_type);
CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON public.transactions(source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id ON public.transactions(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_effective_date ON public.transactions(effective_date);

-- Comentários
COMMENT ON COLUMN public.transactions.source_type IS 'Tipo de origem da transação: manual, commitment, installment, transfer, adjustment';
COMMENT ON COLUMN public.transactions.source_id IS 'ID do registro de origem (commitment_id, installment_id, etc)';
COMMENT ON COLUMN public.transactions.direction IS 'Direção do fluxo: in (entrada) ou out (saída)';
COMMENT ON COLUMN public.transactions.effective_date IS 'Data efetiva do caixa (pode ser diferente de date para projeções)';
COMMENT ON COLUMN public.transactions.transfer_group_id IS 'ID para agrupar transações de transferência (2 transações compartilham o mesmo transfer_group_id)';

