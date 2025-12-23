-- MC10: Script para corrigir vinculação de conexões Pluggy aos entity_id corretos
-- 
-- PROBLEMA: Todas as 3 conexões Pluggy foram criadas com o mesmo entity_id (OLV Internacional)
-- quando deveriam estar vinculadas a entidades diferentes baseado no CPF/CNPJ do usuário que conectou.
--
-- SOLUÇÃO: Este script identifica as conexões Pluggy e permite reatribuí-las manualmente
-- ou via mapeamento baseado em metadados (se disponíveis).
--
-- IMPORTANTE: Execute este script APENAS após validar qual conexão pertence a qual entidade.
-- Se não houver como identificar automaticamente, será necessário mapeamento manual.

-- ========================================
-- PASSO 1: Identificar conexões Pluggy atuais (com entity_id errado)
-- ========================================
SELECT 
  c.id as connection_id,
  c.external_connection_id as pluggy_item_id,
  c.entity_id as current_entity_id,
  e_current.type as current_entity_type,
  e_current.legal_name as current_entity_name,
  e_current.document as current_entity_document,
  c.status,
  c.last_sync_at,
  c.created_at,
  c.metadata
FROM connections c
JOIN providers p ON p.id = c.provider_id
JOIN provider_catalog pc ON pc.id = p.catalog_id
JOIN entities e_current ON e_current.id = c.entity_id
WHERE pc.code = 'pluggy'
  AND c.status = 'active'
ORDER BY c.created_at ASC;

-- ========================================
-- PASSO 2: Listar todas as entidades disponíveis (para referência)
-- ========================================
SELECT 
  e.id as entity_id,
  e.type as entity_type,
  e.legal_name as entity_name,
  e.document as entity_document,
  COUNT(DISTINCT c.id) as current_connections_count
FROM entities e
LEFT JOIN connections c ON c.entity_id = e.id
  AND c.provider_id IN (
    SELECT p.id 
    FROM providers p
    JOIN provider_catalog pc ON pc.id = p.catalog_id
    WHERE pc.code = 'pluggy'
  )
GROUP BY e.id, e.type, e.legal_name, e.document
ORDER BY e.type, e.legal_name;

-- ========================================
-- PASSO 3: MAPEAMENTO MANUAL (Execute APENAS após identificar qual conexão pertence a qual entidade)
-- ========================================
-- 
-- INSTRUÇÕES:
-- 1. Execute PASSO 1 para ver as conexões atuais
-- 2. Execute PASSO 2 para ver as entidades disponíveis
-- 3. Identifique manualmente qual pluggy_item_id pertence a qual entity_id baseado em:
--    - Ordem de criação (created_at)
--    - Metadados da conexão (se houver)
--    - Teste manual conectando cada entidade novamente
-- 4. Execute os UPDATEs abaixo substituindo os valores pelos corretos
--
-- EXEMPLO DE MAPEAMENTO (SUBSTITUA pelos valores reais):
-- 
-- UPDATE connections
-- SET 
--   entity_id = '8ebcd93b-23ca-434b-953c-1d5347253162', -- PF: Marcos Francisco (CPF 08583177880)
--   updated_at = NOW()
-- WHERE id = '<connection_id_da_pf>' -- Substitua pelo ID real da conexão da PF
--   AND external_connection_id = '<pluggy_item_id_da_pf>'; -- Substitua pelo itemId real
--
-- UPDATE connections
-- SET 
--   entity_id = '929d8d06-7e52-4061-9566-19f00c07f483', -- PJ: OLV Internacional (CNPJ 67867580000190)
--   updated_at = NOW()
-- WHERE id = '<connection_id_da_olv>' -- Substitua pelo ID real da conexão da OLV
--   AND external_connection_id = '<pluggy_item_id_da_olv>'; -- Substitua pelo itemId real
--
-- UPDATE connections
-- SET 
--   entity_id = 'd4aa94f1-c0b0-4e7c-9d44-23b655c39b6e', -- PJ: XRP (CNPJ 34338165000190)
--   updated_at = NOW()
-- WHERE id = '<connection_id_da_xrp>' -- Substitua pelo ID real da conexão da XRP
--   AND external_connection_id = '<pluggy_item_id_da_xrp>'; -- Substitua pelo itemId real

-- ========================================
-- PASSO 4: Script de correção automática (SE houver metadados com identificação)
-- ========================================
-- 
-- NOTA: Este script tenta identificar automaticamente baseado em metadados.
-- Se os metadados não contiverem CPF/CNPJ, será necessário mapeamento manual (PASSO 3).
--
-- Descomente e ajuste conforme necessário:

-- DO $$
-- DECLARE
--   conn_record RECORD;
--   target_entity_id UUID;
-- BEGIN
--   FOR conn_record IN (
--     SELECT c.id, c.external_connection_id, c.metadata, c.entity_id
--     FROM connections c
--     JOIN providers p ON p.id = c.provider_id
--     JOIN provider_catalog pc ON pc.id = p.catalog_id
--     WHERE pc.code = 'pluggy'
--       AND c.status = 'active'
--   ) LOOP
--     -- Tentar identificar entity_id baseado em metadados ou lógica de negócio
--     -- Exemplo: se metadata contém CPF/CNPJ, buscar entity correspondente
--     
--     -- Se não houver como identificar automaticamente, pular esta conexão
--     -- e fazer mapeamento manual (PASSO 3)
--     
--     -- target_entity_id := ... (lógica de identificação)
--     
--     -- IF target_entity_id IS NOT NULL THEN
--     --   UPDATE connections
--     --   SET entity_id = target_entity_id, updated_at = NOW()
--     --   WHERE id = conn_record.id;
--     -- END IF;
--   END LOOP;
-- END $$;

-- ========================================
-- PASSO 5: Validação pós-correção
-- ========================================
SELECT 
  e.id as entity_id,
  e.type as entity_type,
  e.legal_name as entity_name,
  e.document as entity_document,
  COUNT(DISTINCT c.id) as connections_count,
  COUNT(DISTINCT a.id) as accounts_count,
  COUNT(DISTINCT t.id) as transactions_count
FROM entities e
LEFT JOIN connections c ON c.entity_id = e.id
  AND c.provider_id IN (
    SELECT p.id 
    FROM providers p
    JOIN provider_catalog pc ON pc.id = p.catalog_id
    WHERE pc.code = 'pluggy'
  )
LEFT JOIN accounts a ON a.entity_id = e.id AND a.source = 'pluggy'
LEFT JOIN transactions t ON t.entity_id = e.id AND t.source = 'pluggy'
GROUP BY e.id, e.type, e.legal_name, e.document
ORDER BY e.type, e.legal_name;

-- ========================================
-- PASSO 6: Limpar dados incorretos (OPCIONAL - apenas se necessário)
-- ========================================
-- 
-- ATENÇÃO: Execute APENAS se quiser remover accounts/transactions que foram
-- criados com entity_id errado. Isso vai deletar dados, então tenha certeza!
--
-- Exemplo (descomente e ajuste):
--
-- -- Deletar accounts do Pluggy vinculados ao entity_id errado
-- DELETE FROM accounts
-- WHERE source = 'pluggy'
--   AND entity_id = '929d8d06-7e52-4061-9566-19f00c07f483' -- OLV (entity_id antigo)
--   AND id NOT IN (
--     -- Manter apenas accounts que realmente pertencem à OLV
--     SELECT a.id
--     FROM accounts a
--     JOIN connections c ON c.entity_id = '929d8d06-7e52-4061-9566-19f00c07f483'
--     WHERE a.source = 'pluggy'
--       AND a.external_id IN (
--         -- Lista de external_ids que realmente pertencem à OLV
--         SELECT ... -- Ajustar conforme necessário
--       )
--   );
--
-- -- Deletar transactions do Pluggy vinculados ao entity_id errado
-- DELETE FROM transactions
-- WHERE source = 'pluggy'
--   AND entity_id = '929d8d06-7e52-4061-9566-19f00c07f483' -- OLV (entity_id antigo)
--   AND id NOT IN (
--     -- Manter apenas transactions que realmente pertencem à OLV
--     SELECT t.id
--     FROM transactions t
--     JOIN connections c ON c.entity_id = '929d8d06-7e52-4061-9566-19f00c07f483'
--     WHERE t.source = 'pluggy'
--       AND t.external_id IN (
--         -- Lista de external_ids que realmente pertencem à OLV
--         SELECT ... -- Ajustar conforme necessário
--       )
--   );

