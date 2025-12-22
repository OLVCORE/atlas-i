-- ========================================
-- TESTE DE INSERT MC4.3 - Execute no Supabase SQL Editor
-- Este script usa os IDs reais automaticamente
-- ========================================

-- Teste 1: Inserir um commitment de teste
DO $$
DECLARE
  v_workspace_id uuid;
  v_entity_id uuid;
  v_commitment_id uuid;
BEGIN
  -- Pegar o primeiro workspace do usuário atual
  SELECT wm.workspace_id INTO v_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;
  
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não é membro de nenhum workspace';
  END IF;
  
  -- Pegar a primeira entity desse workspace
  SELECT id INTO v_entity_id
  FROM public.entities
  WHERE workspace_id = v_workspace_id
  LIMIT 1;
  
  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Não há entities no workspace %. Crie uma entity primeiro.', v_workspace_id;
  END IF;
  
  -- Tentar inserir um commitment de teste
  INSERT INTO public.financial_commitments (
    workspace_id,
    entity_id,
    type,
    description,
    total_amount,
    start_date,
    status,
    recurrence,
    currency
  ) VALUES (
    v_workspace_id,
    v_entity_id,
    'expense',
    'Teste diagnóstico MC4.3 - ' || NOW()::text,
    100.00,
    CURRENT_DATE,
    'planned',
    'none',
    'BRL'
  )
  RETURNING id INTO v_commitment_id;
  
  RAISE NOTICE 'SUCCESS: Commitment inserido! id=%, workspace_id=%, entity_id=%', 
    v_commitment_id, v_workspace_id, v_entity_id;
    
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ERRO ao inserir commitment: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Teste 2: Inserir um contract de teste
DO $$
DECLARE
  v_workspace_id uuid;
  v_entity_id uuid;
  v_contract_id uuid;
BEGIN
  -- Pegar o primeiro workspace do usuário atual
  SELECT wm.workspace_id INTO v_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
  LIMIT 1;
  
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não é membro de nenhum workspace';
  END IF;
  
  -- Pegar a primeira entity desse workspace
  SELECT id INTO v_entity_id
  FROM public.entities
  WHERE workspace_id = v_workspace_id
  LIMIT 1;
  
  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Não há entities no workspace %. Crie uma entity primeiro.', v_workspace_id;
  END IF;
  
  -- Tentar inserir um contract de teste
  INSERT INTO public.contracts (
    workspace_id,
    counterparty_entity_id,
    title,
    description,
    total_value,
    start_date,
    status,
    currency
  ) VALUES (
    v_workspace_id,
    v_entity_id,
    'Teste Contrato MC4.3 - ' || NOW()::text,
    'Contrato de teste para diagnóstico',
    5000.00,
    CURRENT_DATE,
    'draft',
    'BRL'
  )
  RETURNING id INTO v_contract_id;
  
  RAISE NOTICE 'SUCCESS: Contract inserido! id=%, workspace_id=%, counterparty_entity_id=%', 
    v_contract_id, v_workspace_id, v_entity_id;
    
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ERRO ao inserir contract: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- Verificar resultados
SELECT 'Commitments' as tabela, COUNT(*) as total FROM public.financial_commitments
UNION ALL
SELECT 'Contracts' as tabela, COUNT(*) as total FROM public.contracts;

