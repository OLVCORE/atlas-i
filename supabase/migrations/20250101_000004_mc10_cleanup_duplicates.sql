-- MC10: Script para limpar conexões duplicadas do Pluggy
-- Mantém apenas 1 conexão por (entity_id, provider_id, external_connection_id)
-- Marca duplicadas como status='revoked' (não deleta para manter histórico)

-- Identificar duplicatas (manter a mais recente)
WITH duplicates AS (
  SELECT 
    id,
    workspace_id,
    entity_id,
    provider_id,
    external_connection_id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, entity_id, provider_id, external_connection_id 
      ORDER BY created_at DESC
    ) as rn
  FROM public.connections
  WHERE external_connection_id IS NOT NULL
    AND provider_id IN (
      SELECT p.id 
      FROM public.providers p
      JOIN public.provider_catalog pc ON pc.id = p.catalog_id
      WHERE pc.code = 'pluggy'
    )
)
UPDATE public.connections
SET 
  status = 'revoked',
  updated_at = now(),
  last_error = 'Marcada como duplicada durante limpeza'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Comentário: Se quiser deletar completamente (não recomendado para manter histórico):
-- DELETE FROM public.connections WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

