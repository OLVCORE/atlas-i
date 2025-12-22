# MC1 - Corrigir Recursão Infinita na Policy RLS

## Problema

Erro: "infinite recursion detected in policy for relation 'workspace_members'"

## Causa

A policy de SELECT em `workspace_members` estava consultando a própria tabela `workspace_members`, criando recursão infinita:

```sql
-- ANTES (CAUSAVA RECURSÃO)
CREATE POLICY "workspace_members_select_for_members"
    ON public.workspace_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm  -- ← Consulta a mesma tabela!
            WHERE wm.workspace_id = workspace_members.workspace_id
            AND wm.user_id = auth.uid()
        )
    );
```

## Solução

Corrigir a policy para NÃO consultar `workspace_members` dentro da própria policy. Usar apenas `workspaces`:

```sql
-- DEPOIS (SEM RECURSÃO)
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
```

## Como Aplicar a Correção

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko

2. **Vá para SQL Editor:**
   - Menu lateral > SQL Editor

3. **Execute apenas a parte da policy corrigida:**

```sql
-- Corrigir policy de SELECT em workspace_members
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
```

4. **Verificar:**
   - Execute e veja mensagem de sucesso
   - Recarregue a página `/app` no navegador
   - O workspace deve aparecer sem erros

## Nota

Esta solução funciona para MC1 onde cada usuário geralmente gerencia apenas seu próprio workspace. Se no futuro for necessário que membros de um workspace vejam outros membros, será necessário criar uma função SECURITY DEFINER para evitar recursão.

