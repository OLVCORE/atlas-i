-- MC5: Transaction Reversal Support
-- Adiciona campo reversed_by_id para rastrear reversões contábeis

-- Adicionar campo reversed_by_id em transactions (nullable, referencia transactions.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'transactions'
    AND column_name = 'reversed_by_id'
  ) THEN
    ALTER TABLE public.transactions
    ADD COLUMN reversed_by_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_transactions_reversed_by_id ON public.transactions(reversed_by_id);
  END IF;
END $$;

COMMENT ON COLUMN public.transactions.reversed_by_id IS 'ID da transação que reverteu esta transação. Se NULL, transação não foi revertida.';

