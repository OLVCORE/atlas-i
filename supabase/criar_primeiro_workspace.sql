-- =============================================================================
-- Criar primeiro workspace (rodar no SQL Editor do Supabase)
-- =============================================================================
-- Use este script quando não existir nenhum workspace e você ver o erro
-- "Para usar sem login: ... Crie um workspace (ex.: faça login uma vez)."
--
-- Pré-requisito: deve existir pelo menos 1 usuário em auth.users.
-- Se não tiver: vá em /login no app e crie uma conta, OU no Supabase:
--   Authentication > Users > Add user (crie um usuário com email/senha).
-- Depois rode este SQL.
-- =============================================================================

DO $$
DECLARE
  primeiro_user_id uuid;
  novo_workspace_id uuid;
BEGIN
  -- Pegar o primeiro usuário cadastrado
  SELECT id INTO primeiro_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF primeiro_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário em auth.users. Crie uma conta em /login no app ou em Authentication > Users no Supabase.';
  END IF;

  -- Criar workspace "Meu Workspace"
  INSERT INTO public.workspaces (name, created_by)
  VALUES ('Meu Workspace', primeiro_user_id)
  RETURNING id INTO novo_workspace_id;

  -- Adicionar o usuário como owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (novo_workspace_id, primeiro_user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RAISE NOTICE 'Workspace "Meu Workspace" criado com sucesso. ID: %', novo_workspace_id;
END $$;
