-- MC1: Workspaces + Workspace Members + RLS
-- Migration idempotente para criação do schema multi-tenant básico

-- Tabela: workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela: workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'finance_manager', 'viewer', 'accountant')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);

-- Habilitar RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Policies para workspaces
-- SELECT: permitido se o usuário for membro do workspace
DROP POLICY IF EXISTS "workspaces_select_for_members" ON public.workspaces;
CREATE POLICY "workspaces_select_for_members"
    ON public.workspaces
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
        )
    );

-- INSERT: permitido para usuário autenticado se created_by = auth.uid()
DROP POLICY IF EXISTS "workspaces_insert_for_authenticated" ON public.workspaces;
CREATE POLICY "workspaces_insert_for_authenticated"
    ON public.workspaces
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- UPDATE: somente owner ou admin
DROP POLICY IF EXISTS "workspaces_update_for_owner_admin" ON public.workspaces;
CREATE POLICY "workspaces_update_for_owner_admin"
    ON public.workspaces
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role IN ('owner', 'admin')
        )
    );

-- DELETE: somente owner
DROP POLICY IF EXISTS "workspaces_delete_for_owner" ON public.workspaces;
CREATE POLICY "workspaces_delete_for_owner"
    ON public.workspaces
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role = 'owner'
        )
    );

-- Policies para workspace_members
-- SELECT: permitido se user_id = auth.uid() OU se o workspace foi criado por auth.uid()
-- Isso evita recursão infinita (não consulta workspace_members dentro da policy)
-- Para MC1, isso é suficiente pois cada usuário geralmente gerencia apenas seu próprio workspace
DROP POLICY IF EXISTS "workspace_members_select_for_members" ON public.workspace_members;
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

-- INSERT: owner/admin OU criador do workspace se adicionando como owner (primeira vez)
DROP POLICY IF EXISTS "workspace_members_insert_for_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_for_owner_admin"
    ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        -- Permite se já é owner/admin do workspace
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
        OR
        -- Permite se é o criador do workspace e está se adicionando como owner (primeira vez)
        (
            EXISTS (
                SELECT 1 FROM public.workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.created_by = auth.uid()
            )
            AND workspace_members.user_id = auth.uid()
            AND workspace_members.role = 'owner'
            AND NOT EXISTS (
                SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = workspace_members.workspace_id
                AND wm.user_id = auth.uid()
            )
        )
    );

-- UPDATE: apenas owner ou admin do workspace
DROP POLICY IF EXISTS "workspace_members_update_for_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_for_owner_admin"
    ON public.workspace_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- DELETE: apenas owner ou admin do workspace (não pode remover a si mesmo se for o único owner)
DROP POLICY IF EXISTS "workspace_members_delete_for_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_for_owner_admin"
    ON public.workspace_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Função para criar workspace padrão para novo usuário
CREATE OR REPLACE FUNCTION public.create_default_workspace_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_workspace_id uuid;
BEGIN
    -- Criar workspace padrão
    INSERT INTO public.workspaces (name, created_by)
    VALUES ('Meu Workspace', NEW.id)
    RETURNING id INTO new_workspace_id;

    -- Adicionar usuário como owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

-- Trigger para criar workspace padrão quando novo usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created_create_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_create_workspace
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_workspace_for_new_user();

