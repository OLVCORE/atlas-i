-- ========================================
-- DIAGNÓSTICO MC4.3 - RLS e Inserção
-- Execute estas queries no Supabase SQL Editor
-- ========================================

-- 1. Verificar workspaces disponíveis
SELECT id, name, created_at 
FROM public.workspaces 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Verificar entities disponíveis
SELECT id, legal_name, type, workspace_id 
FROM public.entities 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Verificar se você é membro do workspace
SELECT wm.workspace_id, w.name, wm.role
FROM public.workspace_members wm
JOIN public.workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid();

-- 4. Verificar se as policies de INSERT existem
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('financial_commitments', 'contracts', 'financial_schedules', 'contract_schedules')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

-- 5. Testar INSERT manual (substitua os valores pelos IDs reais da query 1 e 2)
-- IMPORTANTE: Use os IDs reais das queries acima
/*
-- Exemplo de INSERT de teste (descomente e ajuste):
DO $$
DECLARE
  v_workspace_id uuid;
  v_entity_id uuid;
BEGIN
  -- Pegar o primeiro workspace do usuário
  SELECT wm.workspace_id INTO v_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;
  
  -- Pegar a primeira entity desse workspace
  SELECT id INTO v_entity_id
  FROM public.entities
  WHERE workspace_id = v_workspace_id
  LIMIT 1;
  
  -- Tentar inserir um commitment de teste
  INSERT INTO public.financial_commitments (
    workspace_id,
    entity_id,
    type,
    description,
    total_amount,
    start_date,
    status,
    recurrence
  ) VALUES (
    v_workspace_id,
    v_entity_id,
    'expense',
    'Teste diagnóstico MC4.3',
    100.00,
    CURRENT_DATE,
    'planned',
    'none'
  );
  
  RAISE NOTICE 'Commitment inserido com sucesso! workspace_id=%, entity_id=%', v_workspace_id, v_entity_id;
END $$;
*/

-- 6. Verificar commitments existentes
SELECT 
  id,
  workspace_id,
  entity_id,
  type,
  description,
  total_amount,
  status,
  created_at
FROM public.financial_commitments
ORDER BY created_at DESC
LIMIT 10;

-- 7. Verificar contracts existentes
SELECT 
  id,
  workspace_id,
  counterparty_entity_id,
  title,
  total_value,
  status,
  created_at
FROM public.contracts
ORDER BY created_at DESC
LIMIT 10;

-- 8. Ver logs de erro recentes (se houver tabela de logs)
-- SELECT * FROM logs WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC;

