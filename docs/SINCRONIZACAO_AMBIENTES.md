# Sincronização entre Ambiente Local e Vercel (Produção)

## Problema Identificado

O sistema está funcionando de forma diferente entre o ambiente local e o Vercel (produção). Isso geralmente acontece por:

1. **Migrations não aplicadas no Supabase de produção**
2. **Variáveis de ambiente diferentes**
3. **Dependências desatualizadas**

## Checklist de Sincronização

### 1. Verificar Variáveis de Ambiente

#### No Vercel:
1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `atlas-i`
3. Vá em **Settings** → **Environment Variables**
4. Verifique se as seguintes variáveis estão configuradas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (se necessário)

#### No Local:
Verifique o arquivo `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**IMPORTANTE:** O Vercel deve apontar para o **Supabase de PRODUÇÃO**, enquanto o local pode apontar para o Supabase de desenvolvimento.

### 2. Aplicar Migrations no Supabase de Produção

#### Migrations Pendentes (Criadas Recentemente):

1. **`20250126_000002_fix_debit_note_items_rls.sql`**
   - Corrige RLS para permitir `contract_schedule_id IS NULL` em `debit_note_items`
   - **CRÍTICO** para funcionamento de despesas/descontos

2. **`20250126_000003_debit_notes_soft_delete.sql`**
   - Adiciona coluna `deleted_at` em `debit_notes`
   - **CRÍTICO** para deleção permanente funcionar corretamente

3. **`20250125_000004_contract_line_items.sql`**
   - Cria tabela `contract_line_items` para despesas/descontos de contratos

4. **`20250125_000003_fix_contract_schedules_deleted_at.sql`**
   - Adiciona `deleted_at` em `contract_schedules` e trigger de cascata

5. **`20250125_000002_contracts_improvements.sql`**
   - Adiciona campos de valor, reajuste, etc. em `contracts`

#### Como Aplicar no Supabase de Produção:

**Opção 1: Via Supabase Dashboard (Recomendado)**
1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto de **PRODUÇÃO**
3. Vá em **SQL Editor**
4. Para cada migration pendente:
   - Abra o arquivo `.sql` da migration
   - Cole o conteúdo no SQL Editor
   - Execute (Run)

**Opção 2: Via Supabase CLI**
```bash
# Conectar ao projeto de produção
supabase link --project-ref <PROJECT_REF_PRODUCTION>

# Aplicar migrations pendentes
supabase db push
```

**Opção 3: Aplicar Manualmente (SQL Direto)**
Execute cada migration manualmente no SQL Editor do Supabase de produção.

### 3. Verificar Dependências

#### No Vercel:
1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `atlas-i`
3. Vá em **Settings** → **General**
4. Verifique a versão do Node.js (deve ser >= 18)

#### No Local:
```bash
node --version  # Deve ser >= 18
npm --version
```

### 4. Verificar RLS Policies

As políticas de Row Level Security (RLS) devem ser idênticas em ambos os ambientes.

#### Verificar no Supabase Dashboard:
1. Acesse o projeto de **PRODUÇÃO**
2. Vá em **Authentication** → **Policies**
3. Verifique as políticas para:
   - `debit_notes` (deve ter `debit_notes_delete_for_members`)
   - `debit_note_items` (deve permitir `contract_schedule_id IS NULL`)

### 5. Testar Sincronização

Após aplicar as migrations:

1. **Teste Local:**
   ```bash
   npm run dev
   # Teste a deleção de uma nota de débito cancelada
   ```

2. **Teste Vercel:**
   - Acesse: https://atlas-i.vercel.app/app/debit-notes
   - Teste a deleção de uma nota de débito cancelada
   - Verifique o console do navegador para erros

3. **Verificar Logs:**
   - No Vercel: **Deployments** → Selecione o deployment → **Functions** → Ver logs
   - No Supabase: **Logs** → Verificar erros de RLS ou SQL

## Migrations Críticas para Funcionamento da Deleção

### Migration: `20250126_000003_debit_notes_soft_delete.sql`
```sql
-- Adicionar deleted_at em debit_notes
ALTER TABLE public.debit_notes ADD COLUMN deleted_at timestamptz;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_debit_notes_deleted_at 
ON public.debit_notes(deleted_at) WHERE deleted_at IS NULL;
```

### Migration: `20250126_000002_fix_debit_note_items_rls.sql`
```sql
-- Ajustar RLS para permitir NULL em contract_schedule_id
DROP POLICY IF EXISTS debit_note_items_insert_for_members ON public.debit_note_items;

CREATE POLICY debit_note_items_insert_for_members
    ON public.debit_note_items
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id
            FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
        AND debit_note_id IN (
            SELECT id
            FROM public.debit_notes
            WHERE workspace_id = debit_note_items.workspace_id
        )
        AND (
            contract_schedule_id IS NULL -- Permitir NULL para despesas/descontos
            OR contract_schedule_id IN (
                SELECT id
                FROM public.contract_schedules
                WHERE workspace_id = debit_note_items.workspace_id
            )
        )
    );
```

## Troubleshooting

### Erro: "column debit_notes.deleted_at does not exist"
**Solução:** Aplicar a migration `20250126_000003_debit_notes_soft_delete.sql` no Supabase de produção.

### Erro: "new row violates row-level security policy"
**Solução:** Aplicar a migration `20250126_000002_fix_debit_note_items_rls.sql` no Supabase de produção.

### Deleção não funciona no Vercel mas funciona localmente
**Causa:** Migration não aplicada ou RLS policy diferente.
**Solução:** Verificar e aplicar todas as migrations pendentes.

## Próximos Passos

1. ✅ Aplicar todas as migrations pendentes no Supabase de produção
2. ✅ Verificar variáveis de ambiente no Vercel
3. ✅ Testar deleção no Vercel
4. ✅ Verificar logs de erro no Vercel e Supabase

## Contato

Se o problema persistir após seguir este guia, verifique:
- Logs do Vercel (Deployments → Functions)
- Logs do Supabase (Logs → Postgres)
- Console do navegador (F12 → Console)
