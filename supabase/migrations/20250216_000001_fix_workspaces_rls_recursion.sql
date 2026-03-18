-- Corrige recursão infinita entre workspaces e workspace_members.
-- workspaces SELECT consultava workspace_members; workspace_members SELECT consultava workspaces.
-- Solução: workspaces permite criador OU membro; workspace_members SELECT só user_id = auth.uid() (não consulta workspaces).

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

DROP POLICY IF EXISTS "workspace_members_select_for_members" ON public.workspace_members;
CREATE POLICY "workspace_members_select_for_members"
    ON public.workspace_members
    FOR SELECT
    USING (user_id = auth.uid());
