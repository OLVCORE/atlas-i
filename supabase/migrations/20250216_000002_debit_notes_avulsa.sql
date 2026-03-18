-- Nota de débito avulsa: permitir contract_id NULL (sem vínculo a contrato)

-- 1) Tornar contract_id opcional em debit_notes
ALTER TABLE public.debit_notes
  ALTER COLUMN contract_id DROP NOT NULL;

-- Remover FK para permitir NULL (a FK já permite NULL se a coluna for nullable)
-- No PostgreSQL, DROP NOT NULL mantém a FK; apenas NULL não é validado contra a FK.
COMMENT ON COLUMN public.debit_notes.contract_id IS 'Contrato vinculado. NULL = nota avulsa (sem contrato).';

-- 2) Ajustar RLS INSERT para permitir contract_id IS NULL
DROP POLICY IF EXISTS debit_notes_insert_for_members ON public.debit_notes;
CREATE POLICY debit_notes_insert_for_members
    ON public.debit_notes
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND (
            contract_id IS NULL
            OR contract_id IN (
                SELECT id
                FROM public.contracts
                WHERE workspace_id = debit_notes.workspace_id
            )
        )
    );
