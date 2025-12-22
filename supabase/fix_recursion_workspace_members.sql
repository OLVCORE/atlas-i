-- MC1 - Correção Urgente: Recursão Infinita na Policy workspace_members
-- Execute este script no SQL Editor do Supabase para corrigir o erro

-- Remover a policy problemática
DROP POLICY IF EXISTS "workspace_members_select_for_members" ON public.workspace_members;

-- Criar a policy corrigida (sem recursão)
CREATE POLICY "workspace_members_select_for_members"
    ON public.workspace_members
    FOR SELECT
    USING (
        -- Permite ver se é o próprio usuário na linha
        user_id = auth.uid()
        OR
        -- Permite ver todos os membros de workspaces que o usuário criou
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_members.workspace_id
            AND w.created_by = auth.uid()
        )
    );

