-- Hotfix: permitir INSERIR NOTA DE DÉBITO AVULSA (contract_id = NULL)
-- Causa do erro:
--  "new row violates row-level security policy for table \"debit_notes\""
-- porque a policy de INSERT exige contract_id existir em contracts.
--
-- Execute no Supabase (SQL Editor) no projeto que está dando erro.

-- Garantir que contract_id seja NULLABLE
ALTER TABLE public.debit_notes
  ALTER COLUMN contract_id DROP NOT NULL;

-- Recriar policy de INSERT com suporte a avulsa (contract_id IS NULL)
DROP POLICY IF EXISTS debit_notes_insert_for_members ON public.debit_notes;

CREATE POLICY debit_notes_insert_for_members
  ON public.debit_notes
  FOR INSERT
  WITH CHECK (
    (
      -- Preferimos checar membership, mas também aceitamos o criador do workspace
      workspace_id IN (
        SELECT workspace_id
        FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
      OR
      workspace_id IN (
        SELECT id
        FROM public.workspaces
        WHERE created_by = auth.uid()
      )
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

