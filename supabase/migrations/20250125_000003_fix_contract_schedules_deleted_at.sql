-- HOTFIX: Adicionar deleted_at em contract_schedules e garantir que schedules sejam excluídos quando contrato for deletado

-- Adicionar deleted_at em contract_schedules se não existir
ALTER TABLE public.contract_schedules
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Índice para filtrar schedules não deletados
CREATE INDEX IF NOT EXISTS idx_contract_schedules_deleted_at ON public.contract_schedules(deleted_at) WHERE deleted_at IS NULL;

-- Comentário
COMMENT ON COLUMN public.contract_schedules.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado. Schedules são automaticamente marcados como deletados quando o contrato é deletado.';

-- Trigger function para marcar schedules como deletados quando contrato for deletado (soft delete)
CREATE OR REPLACE FUNCTION public.mark_contract_schedules_as_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o contrato foi deletado (deleted_at não é NULL), marcar todos os schedules também
  IF NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL OR OLD.deleted_at IS NULL) THEN
    UPDATE public.contract_schedules
    SET deleted_at = NEW.deleted_at
    WHERE contract_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando contrato for atualizado
DROP TRIGGER IF EXISTS trigger_mark_schedules_deleted_on_contract_delete ON public.contracts;
CREATE TRIGGER trigger_mark_schedules_deleted_on_contract_delete
  AFTER UPDATE OF deleted_at ON public.contracts
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND (OLD.deleted_at IS NULL))
  EXECUTE FUNCTION public.mark_contract_schedules_as_deleted();

-- Atualizar schedules existentes de contratos já deletados
UPDATE public.contract_schedules cs
SET deleted_at = c.deleted_at
FROM public.contracts c
WHERE cs.contract_id = c.id
  AND c.deleted_at IS NOT NULL
  AND cs.deleted_at IS NULL;
