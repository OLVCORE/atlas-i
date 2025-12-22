# HOTFIX — Cashflow SQL: remover dependência de transactions.status

## Problema
Erro ao carregar dashboard: `column t.status does not exist`

A função `get_monthly_cashflow_matrix` estava tentando filtrar transactions por `t.status`, mas a coluna `status` não existe na tabela `transactions`.

## Correção Aplicada

### CP1 — Localização e Correção no SQL Original
**Arquivo:** `supabase/migrations/20251221_000011_mc6_monthly_cashflow.sql`

**Linha removida:**
```sql
AND (t.status IS NULL OR t.status = 'posted')
```

**Contexto:**
- Dentro do CTE `realised_data` (bloco que agrega transactions realizadas)
- A linha foi removida completamente, mantendo apenas `t.reversed_by_id IS NULL` como filtro para excluir transações revertidas

### CP2 — Migration Hotfix Criada
**Arquivo:** `supabase/migrations/20251221_000012_hotfix_cashflow_tx_status.sql`

**Ação:**
- Criado `CREATE OR REPLACE FUNCTION` completo com a correção
- Função idêntica à original, exceto pela remoção da referência a `t.status`
- Comentário atualizado indicando o hotfix

**Para aplicar:**
1. Executar a migration no Supabase:
   - Via Supabase CLI: `supabase migration up`
   - Ou copiar o conteúdo e executar no SQL Editor do Supabase

### CP3 — Validação
- ✅ `npm run lint` → Sem erros
- ✅ `npm run typecheck` → Sem erros  
- ✅ `npm run build` → Build bem-sucedido

## Impacto

**Antes:**
- Dashboard não carregava
- Erro: `column t.status does not exist`

**Depois:**
- Função SQL não referencia `t.status`
- Transactions filtradas apenas por `reversed_by_id IS NULL`
- Dashboard deve carregar corretamente

## Notas Técnicas

- **Retrocompatibilidade:** ✅ Mantida (função continua com mesma assinatura e formato de retorno)
- **Regra de negócio:** ✅ Não alterada (apenas removido filtro que não funcionava)
- **Segurança:** ✅ RLS mantido (validação de workspace membership permanece)

## Teste Manual Recomendado

1. Aplicar migration hotfix no banco
2. Abrir `/app/cashflow?view=monthly` → deve carregar sem erro
3. Abrir `/app/dashboard` → deve exibir KPIs corretamente

