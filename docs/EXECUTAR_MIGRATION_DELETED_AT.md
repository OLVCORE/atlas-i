# Como Executar a Migration para Adicionar deleted_at em debit_notes

## ⚠️ ERRO ATUAL
```
Erro ao listar notas de débito: column debit_notes.deleted_at does not exist
```

## ✅ SOLUÇÃO

A migration `20250126_000003_debit_notes_soft_delete.sql` precisa ser executada no Supabase.

### Opção 1: Via Supabase CLI (Recomendado)

```bash
# No diretório do projeto
supabase db reset
```

**OU** apenas aplicar a migration específica:

```bash
supabase migration up
```

### Opção 2: Via Supabase Studio (Manual)

1. **Acesse o Supabase Studio:**
   - Local: `http://localhost:54323` (ou a porta configurada)
   - Produção: Acesse o dashboard do Supabase no Vercel

2. **Vá para SQL Editor**

3. **Execute o seguinte SQL:**

```sql
-- MC14: Adicionar soft delete em debit_notes
-- Adicionar deleted_at em public.debit_notes se não existir

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'debit_notes' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.debit_notes ADD COLUMN deleted_at timestamptz;
    END IF;
END $$;

-- Criar índice para performance em consultas que filtram por deleted_at
CREATE INDEX IF NOT EXISTS idx_debit_notes_deleted_at ON public.debit_notes(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.debit_notes.deleted_at IS 'Data de exclusão (soft delete). NULL = não deletado.';
```

4. **Clique em "Run" ou "Execute"**

### Opção 3: Via Terminal (PostgreSQL direto)

Se você tiver acesso direto ao banco:

```bash
psql -h localhost -U postgres -d postgres -f supabase/migrations/20250126_000003_debit_notes_soft_delete.sql
```

## 🔍 Verificar se Funcionou

Após executar, verifique se a coluna foi criada:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'debit_notes' 
AND column_name = 'deleted_at';
```

Deve retornar:
```
column_name | data_type
------------+---------------
deleted_at  | timestamp with time zone
```

## 📝 Nota Importante

- **Local:** Execute no Supabase local
- **Produção (Vercel):** Execute no Supabase de produção via dashboard
- A migration é idempotente (pode ser executada múltiplas vezes sem problemas)
