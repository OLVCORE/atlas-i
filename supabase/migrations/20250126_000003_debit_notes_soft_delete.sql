-- MC14: Adicionar soft delete em debit_notes
-- Adicionar deleted_at em public.debit_notes se não existir

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.debit_notes ADD COLUMN deleted_at timestamptz;
    END IF;
END $$;

-- Criar índice para performance em consultas que filtram por deleted_at
CREATE INDEX IF NOT EXISTS idx_debit_notes_deleted_at ON public.debit_notes(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.debit_notes.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado.';
