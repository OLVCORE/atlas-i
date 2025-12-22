-- MC3: Cartões + Compras Parceladas (Agenda automática por ciclo)
-- Migration idempotente para criação do schema de cartões e parcelas

-- ========================================
-- CARDS (Cartões de Crédito)
-- ========================================
CREATE TABLE IF NOT EXISTS public.cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    name text NOT NULL,
    brand text,
    closing_day int NOT NULL CHECK (closing_day >= 1 AND closing_day <= 28),
    due_day int NOT NULL CHECK (due_day >= 1 AND due_day <= 28),
    currency text NOT NULL DEFAULT 'BRL',
    is_active bool NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para cards
CREATE INDEX IF NOT EXISTS idx_cards_workspace_id_entity_id ON public.cards(workspace_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_cards_workspace_id_active ON public.cards(workspace_id, is_active);

-- ========================================
-- CARD_PURCHASES (Compra mestre)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    purchase_date date NOT NULL,
    merchant text,
    description text,
    category_id uuid,
    total_amount numeric(14,2) NOT NULL CHECK (total_amount > 0),
    installments int NOT NULL CHECK (installments >= 1),
    first_installment_month date,
    created_by uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para card_purchases
CREATE INDEX IF NOT EXISTS idx_card_purchases_workspace_entity_card ON public.card_purchases(workspace_id, entity_id, card_id);
CREATE INDEX IF NOT EXISTS idx_card_purchases_workspace_date ON public.card_purchases(workspace_id, purchase_date);

-- ========================================
-- CARD_INSTALLMENTS (Agenda de parcelas)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_installments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    purchase_id uuid NOT NULL REFERENCES public.card_purchases(id) ON DELETE CASCADE,
    installment_number int NOT NULL,
    competence_month date NOT NULL,
    amount numeric(14,2) NOT NULL,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'canceled')),
    posted_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(purchase_id, installment_number)
);

-- Índices para card_installments
CREATE INDEX IF NOT EXISTS idx_card_installments_workspace_card_month ON public.card_installments(workspace_id, card_id, competence_month);
CREATE INDEX IF NOT EXISTS idx_card_installments_workspace_entity_month ON public.card_installments(workspace_id, entity_id, competence_month);
CREATE INDEX IF NOT EXISTS idx_card_installments_status ON public.card_installments(status);

-- ========================================
-- CARD_AUDIT_LOG (Auditoria)
-- ========================================
CREATE TABLE IF NOT EXISTS public.card_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para card_audit_log
CREATE INDEX IF NOT EXISTS idx_card_audit_log_workspace_id ON public.card_audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_log_resource ON public.card_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_card_audit_log_created_at ON public.card_audit_log(created_at);

-- ========================================
-- RLS - Habilitar em todas as tabelas
-- ========================================
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_audit_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS POLICIES - CARDS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "cards_select_for_members" ON public.cards;
CREATE POLICY "cards_select_for_members"
    ON public.cards
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity do mesmo workspace
DROP POLICY IF EXISTS "cards_insert_for_members" ON public.cards;
CREATE POLICY "cards_insert_for_members"
    ON public.cards
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND entity_id IN (
            SELECT id
            FROM public.entities
            WHERE workspace_id = cards.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace (não permite trocar workspace_id)
DROP POLICY IF EXISTS "cards_update_for_members" ON public.cards;
CREATE POLICY "cards_update_for_members"
    ON public.cards
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "cards_delete_for_members" ON public.cards;
CREATE POLICY "cards_delete_for_members"
    ON public.cards
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CARD_PURCHASES
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "card_purchases_select_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_select_for_members"
    ON public.card_purchases
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity/card do mesmo workspace
DROP POLICY IF EXISTS "card_purchases_insert_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_insert_for_members"
    ON public.card_purchases
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND entity_id IN (
            SELECT id
            FROM public.entities
            WHERE workspace_id = card_purchases.workspace_id
        )
        AND card_id IN (
            SELECT id
            FROM public.cards
            WHERE workspace_id = card_purchases.workspace_id
        )
        AND created_by = auth.uid()
    );

-- UPDATE: Apenas membros do workspace (não permite trocar workspace_id)
DROP POLICY IF EXISTS "card_purchases_update_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_update_for_members"
    ON public.card_purchases
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "card_purchases_delete_for_members" ON public.card_purchases;
CREATE POLICY "card_purchases_delete_for_members"
    ON public.card_purchases
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CARD_INSTALLMENTS
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "card_installments_select_for_members" ON public.card_installments;
CREATE POLICY "card_installments_select_for_members"
    ON public.card_installments
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e entity/card/purchase do mesmo workspace
DROP POLICY IF EXISTS "card_installments_insert_for_members" ON public.card_installments;
CREATE POLICY "card_installments_insert_for_members"
    ON public.card_installments
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND entity_id IN (
            SELECT id
            FROM public.entities
            WHERE workspace_id = card_installments.workspace_id
        )
        AND card_id IN (
            SELECT id
            FROM public.cards
            WHERE workspace_id = card_installments.workspace_id
        )
        AND purchase_id IN (
            SELECT id
            FROM public.card_purchases
            WHERE workspace_id = card_installments.workspace_id
        )
    );

-- UPDATE: Apenas membros do workspace (não permite trocar workspace_id)
DROP POLICY IF EXISTS "card_installments_update_for_members" ON public.card_installments;
CREATE POLICY "card_installments_update_for_members"
    ON public.card_installments
    FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- DELETE: Apenas membros do workspace
DROP POLICY IF EXISTS "card_installments_delete_for_members" ON public.card_installments;
CREATE POLICY "card_installments_delete_for_members"
    ON public.card_installments
    FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- ========================================
-- RLS POLICIES - CARD_AUDIT_LOG
-- ========================================

-- SELECT: Apenas membros do workspace
DROP POLICY IF EXISTS "card_audit_log_select_for_members" ON public.card_audit_log;
CREATE POLICY "card_audit_log_select_for_members"
    ON public.card_audit_log
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Apenas membros do workspace e actor_user_id = auth.uid()
DROP POLICY IF EXISTS "card_audit_log_insert_for_members" ON public.card_audit_log;
CREATE POLICY "card_audit_log_insert_for_members"
    ON public.card_audit_log
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND actor_user_id = auth.uid()
    );

