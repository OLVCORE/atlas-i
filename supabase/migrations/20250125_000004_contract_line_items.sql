-- MC15: Contract Line Items (Despesas/Descontos)
-- Migration para adicionar suporte a itens de linha (despesas/descontos) em contratos e notas de débito

-- ========================================
-- CONTRACT_LINE_ITEMS (Itens de linha de contratos)
-- ========================================
CREATE TABLE IF NOT EXISTS public.contract_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('expense', 'discount')),
    description text,
    amount numeric(15,2) NOT NULL CHECK (amount != 0),
    item_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_line_items_contract_id ON public.contract_line_items(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_line_items_workspace_id ON public.contract_line_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_line_items_type ON public.contract_line_items(type);
CREATE INDEX IF NOT EXISTS idx_contract_line_items_item_order ON public.contract_line_items(contract_id, item_order);

-- ========================================
-- Atualizar DEBIT_NOTE_ITEMS para suportar itens adicionais
-- ========================================
-- Adicionar campos opcionais para descrição e tipo
ALTER TABLE public.debit_note_items
  ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('expense', 'discount')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS item_order integer NOT NULL DEFAULT 0;

-- Índice para ordenação
CREATE INDEX IF NOT EXISTS idx_debit_note_items_item_order ON public.debit_note_items(debit_note_id, item_order);

-- Comentários
COMMENT ON TABLE public.contract_line_items IS 'Itens de linha (despesas/descontos) associados a contratos';
COMMENT ON COLUMN public.contract_line_items.type IS 'Tipo do item: expense (despesa) ou discount (desconto/crédito/isenção)';
COMMENT ON COLUMN public.contract_line_items.amount IS 'Valor do item (positivo para despesas, negativo para descontos)';
COMMENT ON COLUMN public.contract_line_items.item_order IS 'Ordem de exibição do item dentro do contrato';
COMMENT ON COLUMN public.debit_note_items.type IS 'Tipo do item: expense (despesa) ou discount (desconto/crédito/isenção). NULL = item do schedule';
COMMENT ON COLUMN public.debit_note_items.item_order IS 'Ordem de exibição do item dentro da nota de débito';

-- ========================================
-- RLS - Habilitar
-- ========================================
ALTER TABLE public.contract_line_items ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - CONTRACT_LINE_ITEMS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_select_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_select_for_members"
    ON public.contract_line_items
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_insert_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_insert_for_members"
    ON public.contract_line_items
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
            WHERE workspace_id = contract_line_items.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_update_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_update_for_members"
    ON public.contract_line_items
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "contract_line_items_delete_for_members" ON public.contract_line_items;
CREATE POLICY "contract_line_items_delete_for_members"
    ON public.contract_line_items
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_contract_line_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_contract_line_items_updated_at ON public.contract_line_items;
CREATE TRIGGER trigger_update_contract_line_items_updated_at
    BEFORE UPDATE ON public.contract_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_contract_line_items_updated_at();
