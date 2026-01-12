-- HOTFIX: Adicionar deleted_at em accounts para soft delete
-- Migration idempotente

-- Adicionar deleted_at em accounts se não existir
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Criar índice para performance em queries que filtram deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON public.accounts(deleted_at) WHERE deleted_at IS NULL;

-- Comentário na coluna
COMMENT ON COLUMN public.accounts.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado';
