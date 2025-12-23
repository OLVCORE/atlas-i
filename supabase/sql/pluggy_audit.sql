-- MC10: SQL de Auditoria Pluggy (CORRETO - sem provider_key)
-- Queries para verificar status de conexões, contas e transações do Pluggy

-- ========================================
-- 1. Connections Pluggy com entidade
-- ========================================
SELECT 
  c.id,
  c.workspace_id,
  c.entity_id,
  e.type as entity_type,
  e.legal_name as entity_name,
  e.document as entity_document,
  c.provider_id,
  c.external_connection_id as pluggy_item_id,
  c.status,
  c.last_sync_at,
  c.last_error,
  c.created_at,
  pc.code as provider_code,
  pc.name as provider_name
FROM connections c
JOIN entities e ON e.id = c.entity_id
JOIN providers p ON p.id = c.provider_id
LEFT JOIN provider_catalog pc ON pc.id = p.catalog_id
WHERE pc.code = 'pluggy'
ORDER BY c.created_at DESC;

-- ========================================
-- 2. Contas Pluggy por entidade
-- ========================================
SELECT 
  a.id,
  a.entity_id,
  e.type as entity_type,
  e.legal_name as entity_name,
  e.document as entity_document,
  a.name as account_name,
  a.type as account_type,
  a.opening_balance as balance,
  a.currency,
  a.source,
  a.external_id as pluggy_account_id,
  a.created_at
FROM accounts a
JOIN entities e ON e.id = a.entity_id
WHERE a.source = 'pluggy'
ORDER BY a.created_at DESC
LIMIT 50;

-- ========================================
-- 3. Transações Pluggy por entidade
-- ========================================
SELECT 
  t.id,
  t.entity_id,
  e.type as entity_type,
  e.legal_name as entity_name,
  e.document as entity_document,
  t.description,
  t.amount,
  t.type as transaction_type,
  t.date,
  t.currency,
  t.source,
  t.external_id as pluggy_transaction_id,
  t.created_at
FROM transactions t
JOIN entities e ON e.id = t.entity_id
WHERE t.source = 'pluggy'
ORDER BY t.created_at DESC
LIMIT 50;

-- ========================================
-- 4. Resumo: Contagens por entidade
-- ========================================
SELECT 
  e.id as entity_id,
  e.type as entity_type,
  e.legal_name as entity_name,
  e.document as entity_document,
  COUNT(DISTINCT c.id) as total_connections,
  COUNT(DISTINCT a.id) as total_accounts,
  COUNT(DISTINCT t.id) as total_transactions,
  MAX(c.last_sync_at) as last_sync_any_connection
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
ORDER BY total_accounts DESC, total_transactions DESC;

