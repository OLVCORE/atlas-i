-- MC_DEBIT_NOTES_CLIENT_NOTES: Adicionar campos client_name e notes em debit_notes

-- Adicionar client_name (nome do cliente para preenchimento manual)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'debit_notes' AND column_name = 'client_name') THEN
        ALTER TABLE public.debit_notes ADD COLUMN client_name text;
        RAISE NOTICE 'Coluna client_name adicionada em debit_notes';
    ELSE
        RAISE NOTICE 'Coluna client_name já existe em debit_notes';
    END IF;
END $$;

-- Adicionar notes (observações: informações de depósito/PIX, informações pertinentes ao contrato)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'debit_notes' AND column_name = 'notes') THEN
        ALTER TABLE public.debit_notes ADD COLUMN notes text;
        RAISE NOTICE 'Coluna notes adicionada em debit_notes';
    ELSE
        RAISE NOTICE 'Coluna notes já existe em debit_notes';
    END IF;
END $$;

COMMENT ON COLUMN public.debit_notes.client_name IS 'Nome do cliente (preenchimento manual)';
COMMENT ON COLUMN public.debit_notes.notes IS 'Observações: informações de depósito/PIX, informações pertinentes ao contrato';
