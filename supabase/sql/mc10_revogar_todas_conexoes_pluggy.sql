-- MC10: Script rápido para revogar todas as conexões Pluggy do tenant atual
-- 
-- ATENÇÃO: Este script revoga TODAS as conexões Pluggy ativas.
-- Use apenas se quiser limpar todas as conexões antes de criar um novo tenant.
--
-- Se quiser revogar apenas conexões específicas, use o endpoint DELETE /api/connections/[connectionId]
-- ou edite este script para filtrar por external_connection_id específico.

-- Revogar todas as conexões Pluggy ativas (marcar como 'revoked')
UPDATE connections
SET 
  status = 'revoked',
  last_error = 'Conexões revogadas para limpeza antes de novo tenant',
  updated_at = NOW()
WHERE id IN (
  SELECT c.id
  FROM connections c
  JOIN providers p ON p.id = c.provider_id
  JOIN provider_catalog pc ON pc.id = p.catalog_id
  WHERE pc.code = 'pluggy'
    AND c.status = 'active'
);

-- Verificar resultado
SELECT 
  c.id,
  c.external_connection_id as pluggy_item_id,
  e.legal_name as entity_name,
  e.document as entity_document,
  c.status,
  c.last_error,
  c.updated_at
FROM connections c
JOIN providers p ON p.id = c.provider_id
JOIN provider_catalog pc ON pc.id = p.catalog_id
JOIN entities e ON e.id = c.entity_id
WHERE pc.code = 'pluggy'
ORDER BY c.updated_at DESC;

