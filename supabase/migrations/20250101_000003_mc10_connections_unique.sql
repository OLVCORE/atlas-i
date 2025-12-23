-- MC10: Impedir conexões duplicadas do Pluggy
-- UNIQUE INDEX em connections para garantir idempotência

DROP INDEX IF EXISTS connections_unique_pluggy;

CREATE UNIQUE INDEX connections_unique_pluggy 
ON public.connections(workspace_id, entity_id, provider_id, external_connection_id) 
WHERE external_connection_id IS NOT NULL;

