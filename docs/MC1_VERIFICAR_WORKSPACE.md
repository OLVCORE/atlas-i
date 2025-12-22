# MC1 - Verificar se Workspace foi Criado

## Problema

Erro ao carregar workspace após login. O trigger pode não ter criado o workspace automaticamente se o usuário foi confirmado manualmente.

## Verificar se Workspace Existe

Execute no **SQL Editor** do Supabase:

```sql
-- Verificar se o usuário tem workspace
SELECT 
  u.id as user_id,
  u.email,
  w.id as workspace_id,
  w.name as workspace_name,
  wm.role
FROM auth.users u
LEFT JOIN workspace_members wm ON wm.user_id = u.id
LEFT JOIN workspaces w ON w.id = wm.workspace_id
WHERE u.email = 'marcos.oliveira@olvinternacional.com.br';
```

## Se Workspace NÃO Existe

Se o resultado mostrar `workspace_id` como `null`, crie manualmente:

```sql
-- Obter o ID do usuário
SELECT id FROM auth.users WHERE email = 'marcos.oliveira@olvinternacional.com.br';

-- Criar workspace (substitua 'cfa785b1-4af4-4b6b-a5d3-ecdb1a84270c' pelo ID real do usuário)
INSERT INTO workspaces (name, created_by)
VALUES ('Meu Workspace', 'cfa785b1-4af4-4b6b-a5d3-ecdb1a84270c')
RETURNING id;

-- Adicionar usuário como owner (substitua os IDs pelos valores retornados acima)
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES (
  'id-do-workspace-retornado',
  'cfa785b1-4af4-4b6b-a5d3-ecdb1a84270c',
  'owner'
);
```

## Solução Automática (Mais Simples)

Ou simplesmente use um script que faz tudo de uma vez:

```sql
DO $$
DECLARE
  v_user_id uuid;
  v_workspace_id uuid;
BEGIN
  -- Obter ID do usuário
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'marcos.oliveira@olvinternacional.com.br';
  
  -- Criar workspace
  INSERT INTO workspaces (name, created_by)
  VALUES ('Meu Workspace', v_user_id)
  RETURNING id INTO v_workspace_id;
  
  -- Adicionar usuário como owner
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
END $$;
```

## Após Criar Workspace

Recarregue a página `/app` no navegador. O workspace deve aparecer.

