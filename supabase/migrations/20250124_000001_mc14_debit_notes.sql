-- MC14: Notas de Débito - Estrutura Base
-- Migration idempotente para criação do schema de notas de débito

-- ========================================
-- ADICIONAR CAMPOS DE REAJUSTE EM CONTRATOS
-- ========================================

-- Adicionar campos de índice de reajuste em contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS adjustment_index text CHECK (adjustment_index IN ('NONE', 'IPCA', 'IGPM', 'CDI', 'MANUAL', 'CUSTOM')),
  ADD COLUMN IF NOT EXISTS adjustment_frequency text CHECK (adjustment_frequency IN ('NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  ADD COLUMN IF NOT EXISTS adjustment_percentage numeric(5,4), -- Para MANUAL ou CUSTOM (ex: 0.045 para 4,5%)
  ADD COLUMN IF NOT EXISTS last_adjustment_date date;

-- Índice para buscar contratos que precisam de reajuste
CREATE INDEX IF NOT EXISTS idx_contracts_adjustment_date 
  ON public.contracts(last_adjustment_date) 
  WHERE adjustment_index IS NOT NULL AND adjustment_index != 'NONE';

-- Atualizar valores padrão para contratos existentes
UPDATE public.contracts
  SET adjustment_index = 'NONE',
      adjustment_frequency = 'NONE'
  WHERE adjustment_index IS NULL;

-- ========================================
-- DEBIT_NOTES (Notas de Débito)
-- ========================================

CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  
  -- Numeração
  number text NOT NULL, -- Ex: "ND-2025-001"
  sequence_number integer NOT NULL, -- 001, 002, etc. (para ordenação)
  
  -- Datas
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  paid_at date, -- Data do pagamento (preenchido na reconciliação)
  
  -- Valores
  total_amount numeric(15,2) NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  
  -- Descrição geral
  description text, -- Ex: "Fatura mensal - jan/2025"
  
  -- Vinculação ao pagamento
  linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(workspace_id, number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debit_notes_workspace_id ON public.debit_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_contract_id ON public.debit_notes(contract_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_status ON public.debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_debit_notes_due_date ON public.debit_notes(due_date);
CREATE INDEX IF NOT EXISTS idx_debit_notes_issued_date ON public.debit_notes(issued_date);
CREATE INDEX IF NOT EXISTS idx_debit_notes_number ON public.debit_notes(workspace_id, number);
CREATE INDEX IF NOT EXISTS idx_debit_notes_linked_transaction_id ON public.debit_notes(linked_transaction_id);

-- ========================================
-- DEBIT_NOTE_ITEMS (Itens da Nota de Débito)
-- ========================================

CREATE TABLE IF NOT EXISTS public.debit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  debit_note_id uuid NOT NULL REFERENCES public.debit_notes(id) ON DELETE CASCADE,
  contract_schedule_id uuid NOT NULL REFERENCES public.contract_schedules(id) ON DELETE CASCADE,
  
  -- Valores
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  
  -- Descrição do item
  description text, -- Ex: "Locação - jan/2025"
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(debit_note_id, contract_schedule_id) -- Um schedule só pode aparecer uma vez por nota
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debit_note_items_workspace_id ON public.debit_note_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debit_note_items_debit_note_id ON public.debit_note_items(debit_note_id);
CREATE INDEX IF NOT EXISTS idx_debit_note_items_contract_schedule_id ON public.debit_note_items(contract_schedule_id);

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debit_note_items ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - DEBIT_NOTES
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_select_for_members'
  ) THEN
    DROP POLICY debit_notes_select_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_select_for_members
    ON public.debit_notes
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_insert_for_members'
  ) THEN
    DROP POLICY debit_notes_insert_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_insert_for_members
    ON public.debit_notes
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND contract_id IN (
            SELECT id
            FROM public.contracts
            WHERE workspace_id = debit_notes.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_update_for_members'
  ) THEN
    DROP POLICY debit_notes_update_for_members ON public.debit_notes;
  END IF;
END
$$;

CREATE POLICY debit_notes_update_for_members
    ON public.debit_notes
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_notes'
      AND policyname = 'debit_notes_delete_for_members'
  ) THEN
    DROP POLICY debit_notes_delete_for_members ON public.debit_notes;
  END IF;
END
$$;

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

-- ========================================
-- RLS POLICIES - DEBIT_NOTE_ITEMS
-- ========================================

-- SELECT: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_select_for_members'
  ) THEN
    DROP POLICY debit_note_items_select_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_select_for_members
    ON public.debit_note_items
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
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
        AND contract_schedule_id IN (
            SELECT id
            FROM public.contract_schedules
            WHERE workspace_id = debit_note_items.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_update_for_members'
  ) THEN
    DROP POLICY debit_note_items_update_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_update_for_members
    ON public.debit_note_items
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'debit_note_items'
      AND policyname = 'debit_note_items_delete_for_members'
  ) THEN
    DROP POLICY debit_note_items_delete_for_members ON public.debit_note_items;
  END IF;
END
$$;

CREATE POLICY debit_note_items_delete_for_members
    ON public.debit_note_items
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );
