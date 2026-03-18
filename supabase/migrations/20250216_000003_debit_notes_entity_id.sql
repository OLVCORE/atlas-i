-- Nota de débito: permitir vincular entidade (cliente) manualmente quando não há contrato

-- Adicionar entity_id em debit_notes (opcional; usado em notas avulsas para identificar o cliente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debit_notes' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.debit_notes
      ADD COLUMN entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL;
    RAISE NOTICE 'Coluna entity_id adicionada em debit_notes';
  ELSE
    RAISE NOTICE 'Coluna entity_id já existe em debit_notes';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_debit_notes_entity_id ON public.debit_notes(entity_id) WHERE entity_id IS NOT NULL;

COMMENT ON COLUMN public.debit_notes.entity_id IS 'Entidade (cliente) vinculada. Preenchimento manual em notas avulsas; em notas com contrato pode vir do contrato.';
