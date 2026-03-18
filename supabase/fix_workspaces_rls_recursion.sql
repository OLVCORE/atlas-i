-- =============================================================================
-- Corrigir erro: "infinite recursion detected in policy for relation workspaces"
-- =============================================================================
-- Causa: workspaces SELECT consulta workspace_members e workspace_members SELECT
-- consulta workspaces -> ciclo. Este script quebra o ciclo nas duas tabelas.
-- Rode no Supabase: SQL Editor > New query > Cole e Execute.
-- =============================================================================

-- 1) workspaces: criador vê sem depender de workspace_members; membros veem via EXISTS
DROP POLICY IF EXISTS "workspaces_select_for_members" ON public.workspaces;
CREATE POLICY "workspaces_select_for_members"
    ON public.workspaces
    FOR SELECT
    USING (
        created_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
        )
    );

-- 2) workspace_members: só user_id = auth.uid() (não consultar workspaces, senão volta o ciclo)
DROP POLICY IF EXISTS "workspace_members_select_for_members" ON public.workspace_members;
CREATE POLICY "workspace_members_select_for_members"
    ON public.workspace_members
    FOR SELECT
    USING (user_id = auth.uid());
