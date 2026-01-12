-- MC14: Fix RLS Policy for debit_note_items to allow NULL contract_schedule_id
-- Permite inserir items adicionais (expenses/discounts) sem contract_schedule_id

-- Remover política antiga
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_insert_for_members'
  ) THEN
    DROP POLICY debit_note_items_insert_for_members ON public.debit_note_items;
  END IF;
END
$$;

-- Criar nova política que permite contract_schedule_id NULL
CREATE POLICY debit_note_items_insert_for_members
    ON public.debit_note_items
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND debit_note_id IN (
            SELECT id
            FROM public.debit_notes
            WHERE workspace_id = debit_note_items.workspace_id
        )
        AND (
            -- Permite contract_schedule_id NULL (para expenses/discounts)
            contract_schedule_id IS NULL
            OR
            -- Ou permite contract_schedule_id válido (para schedules)
            contract_schedule_id IN (
                SELECT id
                FROM public.contract_schedules
                WHERE workspace_id = debit_note_items.workspace_id
            )
        )
    );

COMMENT ON POLICY debit_note_items_insert_for_members ON public.debit_note_items IS 
'Permite inserir items de nota de débito. contract_schedule_id pode ser NULL para expenses/discounts ou válido para schedules vinculados.';
