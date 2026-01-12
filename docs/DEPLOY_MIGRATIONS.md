# Deploy de Migrations para Produção

## Problema

Os dados inseridos no servidor local não aparecem no Vercel porque:
- O **Supabase local** (desenvolvimento) é um banco de dados separado
- O **Supabase de produção** (Vercel) é outro banco de dados
- As migrations precisam ser executadas **em ambos os ambientes**

## Solução

### 1. Executar Migrations no Supabase de Produção

#### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto de produção
3. Vá em **SQL Editor**
4. Para cada migration pendente:
   - Abra o arquivo da migration em `supabase/migrations/`
   - Copie o conteúdo SQL
   - Cole no SQL Editor
   - Execute (Ctrl+Enter ou botão "Run")

#### Opção B: Via Supabase CLI

```bash
# Conectar ao projeto de produção
supabase link --project-ref seu-project-ref

# Executar migrations pendentes
supabase db push
```

### 2. Migrations Pendentes (Verificar)

Execute as seguintes migrations no Supabase de produção (se ainda não foram executadas):

1. ✅ `20250124_000001_mc14_debit_notes.sql` - Tabelas de notas de débito
2. ✅ `20250125_000001_hotfix_cashflow_numeric_to_date.sql` - Hotfix cashflow
3. ✅ `20250125_000002_contracts_improvements.sql` - Melhorias em contratos
4. ✅ `20250125_000003_fix_contract_schedules_deleted_at.sql` - Soft delete em schedules
5. ✅ `20250125_000004_contract_line_items.sql` - Itens de linha de contratos
6. ✅ `20250125_000005_fix_debit_note_items_nullable.sql` - Items nullable em debit_notes
7. ✅ `20250126_000001_accounts_soft_delete.sql` - Soft delete em contas
8. ⚠️ **`20250126_000002_fix_debit_note_items_rls.sql`** - **CRÍTICA: Corrige RLS para expenses/discounts**

### 3. Verificar Migrations Executadas

No Supabase Dashboard:
1. Vá em **Database** > **Migrations**
2. Verifique quais migrations já foram executadas
3. Execute as que estão faltando

### 4. Checklist de Deploy

- [ ] Todas as migrations executadas no Supabase de produção
- [ ] Variáveis de ambiente do Vercel configuradas corretamente
- [ ] Build do Vercel bem-sucedido
- [ ] Testar funcionalidades no ambiente de produção

## Nota Importante

**SEMPRE execute as migrations no Supabase de produção após commits que alteram o schema do banco de dados!**

As migrations são **idempotentes** (podem ser executadas múltiplas vezes sem problemas), mas é melhor verificar antes de executar.
