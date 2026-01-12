-- ========================================
-- FIX COMPLETO PARA DELEÇÃO NO VERCEL
-- Execute este script no Supabase de PRODUÇÃO
-- ========================================

-- 1. Adicionar deleted_at em debit_notes (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.debit_notes ADD COLUMN deleted_at timestamptz;
        RAISE NOTICE 'Coluna deleted_at adicionada em debit_notes';
    ELSE
        RAISE NOTICE 'Coluna deleted_at já existe em debit_notes';
    END IF;
END $$;

-- 2. Criar índice para deleted_at
CREATE INDEX IF NOT EXISTS idx_debit_notes_deleted_at 
ON public.debit_notes(deleted_at) WHERE deleted_at IS NULL;

-- 3. Corrigir RLS Policy para debit_note_items (permitir NULL em contract_schedule_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_insert_for_members'
  ) THEN
    DROP POLICY debit_note_items_insert_for_members ON public.debit_note_items;
    RAISE NOTICE 'Política debit_note_items_insert_for_members removida';
  END IF;
END $$;

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

-- 4. Garantir que a política de DELETE existe para debit_notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_delete_for_members'
  ) THEN
    CREATE POLICY debit_notes_delete_for_members
        ON public.debit_notes
        FOR DELETE
        USING (
            workspace_id IN (
                SELECT workspace_id
                FROM public.workspace_members
                WHERE user_id = auth.uid()
            )
        );
    RAISE NOTICE 'Política debit_notes_delete_for_members criada';
  ELSE
    RAISE NOTICE 'Política debit_notes_delete_for_members já existe';
  END IF;
END $$;

-- 5. Verificar se a tabela debit_note_items tem a coluna type e item_order
DO $$
BEGIN
    -- Adicionar type se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_note_items' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.debit_note_items ADD COLUMN type text CHECK (type IN ('schedule', 'expense', 'discount'));
        RAISE NOTICE 'Coluna type adicionada em debit_note_items';
    END IF;

    -- Adicionar item_order se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_note_items' 
        AND column_name = 'item_order'
    ) THEN
        ALTER TABLE public.debit_note_items ADD COLUMN item_order integer DEFAULT 0;
        RAISE NOTICE 'Coluna item_order adicionada em debit_note_items';
    END IF;

    -- Tornar contract_schedule_id nullable se ainda não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_note_items' 
        AND column_name = 'contract_schedule_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.debit_note_items ALTER COLUMN contract_schedule_id DROP NOT NULL;
        RAISE NOTICE 'contract_schedule_id tornada nullable em debit_note_items';
    END IF;
END $$;

-- 6. Comentários
COMMENT ON COLUMN public.debit_notes.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado.';
COMMENT ON POLICY debit_note_items_insert_for_members ON public.debit_note_items IS 
'Permite inserir items de nota de débito. contract_schedule_id pode ser NULL para expenses/discounts ou válido para schedules vinculados.';

-- ========================================
-- FIM DO FIX
-- ========================================
-- Verificar se tudo está OK:
SELECT 
    'deleted_at existe?' as check_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) as result
UNION ALL
SELECT 
    'RLS delete policy existe?' as check_name,
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'debit_notes'
          AND policyname = 'debit_notes_delete_for_members'
    ) as result
UNION ALL
SELECT 
    'RLS insert policy permite NULL?' as check_name,
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'debit_note_items'
          AND policyname = 'debit_note_items_insert_for_members'
    ) as result;
