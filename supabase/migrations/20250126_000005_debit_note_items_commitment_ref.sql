-- MC14: Adicionar referência a financial_commitments em debit_note_items
-- Permite rastrear compromissos financeiros criados a partir de despesas das notas de débito

-- Adicionar financial_commitment_id em debit_note_items se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'debit_note_items' 
          AND column_name = 'financial_commitment_id'
    ) THEN
        ALTER TABLE public.debit_note_items 
        ADD COLUMN financial_commitment_id uuid REFERENCES public.financial_commitments(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Coluna financial_commitment_id adicionada em debit_note_items';
    ELSE
        RAISE NOTICE 'Coluna financial_commitment_id já existe em debit_note_items';
    END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_debit_note_items_financial_commitment_id 
ON public.debit_note_items(financial_commitment_id) 
WHERE financial_commitment_id IS NOT NULL;

COMMENT ON COLUMN public.debit_note_items.financial_commitment_id IS 
'ID do financial_commitment criado a partir desta despesa da nota de débito. NULL = não provisionado ou não é despesa.';
