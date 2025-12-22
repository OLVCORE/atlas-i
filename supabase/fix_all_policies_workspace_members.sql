-- MC1 - CORREÇÃO COMPLETA: Remover TODAS as policies problemáticas e recriar
-- Execute este script no SQL Editor do Supabase

-- ========================================
-- REMOVER TODAS AS POLICIES DE workspace_members
-- ========================================
DROP POLICY IF EXISTS "workspace_members_select_for_members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_for_owner_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_for_owner_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_for_owner_admin" ON public.workspace_members;

-- ========================================
-- RECRIAR POLICIES SEM RECURSÃO
-- ========================================

-- SELECT: Permite ver APENAS registros onde o user_id é o próprio usuário
-- Isso evita qualquer recursão porque não consulta outras tabelas
CREATE POLICY "workspace_members_select_for_members"
    ON public.workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

-- INSERT: Permite se é o criador do workspace se adicionando como owner (primeira vez)
CREATE POLICY "workspace_members_insert_for_owner_admin"
    ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id
            AND w.created_by = auth.uid()
        )
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
    );

-- UPDATE: Permite se é o criador do workspace
CREATE POLICY "workspace_members_update_for_owner_admin"
    ON public.workspace_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id
            AND w.created_by = auth.uid()
        )
    );

-- DELETE: Permite se é o criador do workspace
CREATE POLICY "workspace_members_delete_for_owner_admin"
    ON public.workspace_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id
            AND w.created_by = auth.uid()
        )
    );

