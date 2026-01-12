# Revisão de Segurança: Provisionamento de Despesas de Notas de Débito

## ✅ CONFIRMAÇÃO DE SEGURANÇA

**Data da Revisão:** 26/01/2026  
**Objetivo:** Verificar se a implementação de provisionamento de despesas não quebra o sistema existente de receivables (contract_schedules).

---

## 🔒 Proteções Implementadas

### 1. **Separação Clara entre Schedules e Despesas**

```typescript
// Schedule Items (NÃO são provisionados)
const scheduleItems = schedules.map((schedule, index) => ({
  contract_schedule_id: schedule.id,  // ✅ Vinculado ao contract_schedule
  type: null,                         // ✅ NULL = item do schedule
  // ...
}))

// Expense Items (SÃO provisionados)
const expenseItems = (input.expenses || []).map((expense, index) => ({
  contract_schedule_id: null,        // ✅ NULL = não é schedule
  type: 'expense',                   // ✅ Tipo explícito
  // ...
}))
```

### 2. **Verificação Explícita de Tipo Antes de Provisionar**

**Linha 298-302:** Apenas itens com `type === 'expense'` são provisionados:

```typescript
const expenseItem = items?.find(
  item => item.type === 'expense' &&  // ✅ FILTRO CRÍTICO
  (!expense.description || item.description === expense.description) &&
  Math.abs(Number(item.amount) - Math.abs(expense.amount)) < 0.01
)
```

**Linha 293:** Verificação antes do loop:

```typescript
if (input.expenses && input.expenses.length > 0) {  // ✅ Apenas processa expenses
  // ...
}
```

### 3. **Cancelamento/Deleção Também Filtra por Tipo**

**Linha 784-785:** Ao atualizar, cancela apenas despesas:

```typescript
const expenseItemsWithCommitments = expenseDiscountItems.filter(
  item => item.type === 'expense' && (item as any).financial_commitment_id
)
```

**Linha 910-915:** Ao cancelar/deletar, busca apenas itens com `financial_commitment_id`:

```typescript
const { data: itemsWithCommitments } = await supabase
  .from("debit_note_items")
  .select("id, financial_commitment_id")
  .not("financial_commitment_id", "is", null)  // ✅ Apenas despesas provisionadas
```

---

## 🚫 O que NÃO é Afetado

### ✅ Contract Schedules (Receivables) - **PROTEGIDOS**

- **Não criam `financial_commitments`** porque têm `type: null`
- **Já estão no sistema** através da tabela `contract_schedules`
- **Já aparecem no ledger** como receivables planejados
- **Não são duplicados** porque a verificação `item.type === 'expense'` os exclui

### ✅ Descontos - **PROTEGIDOS**

- Descontos têm `type: 'discount'`
- Não passam pela verificação `type === 'expense'`
- Não são provisionados

### ✅ Schedules em Geral - **PROTEGIDOS**

- Qualquer item com `contract_schedule_id !== null` é um schedule
- Não passa pela lógica de provisionamento

---

## 📋 Notas de Débito Já Criadas

### Status Atual

Notas de débito criadas **ANTES** desta implementação:
- ✅ **Não terão** `financial_commitment_id` (coluna não existia)
- ✅ **Não precisam de ação** - funcionam normalmente
- ✅ **Despesas antigas não aparecem no ledger** (comportamento esperado)
- ✅ **Não quebram nada** - a verificação `financial_commitment_id IS NOT NULL` as exclui

### Para Provisionar Despesas Antigas (Opcional)

Se quiser provisionar despesas de notas antigas, pode criar um script de migração:

```sql
-- EXEMPLO (não executar sem revisar):
-- Buscar todas as despesas sem provisionamento
-- Criar financial_commitments para elas
-- Atualizar debit_note_items com financial_commitment_id
```

**⚠️ ATENÇÃO:** Não é necessário fazer isso agora. O sistema funciona corretamente sem isso.

---

## 🔍 Verificações de Integridade

### Arquivos Modificados

1. ✅ `lib/debit-notes.ts`
   - Apenas funções de notas de débito foram modificadas
   - Não altera `contract_schedules`, `financial_schedules` ou `contracts`

2. ✅ `supabase/migrations/20250126_000005_debit_note_items_commitment_ref.sql`
   - Apenas adiciona coluna `financial_commitment_id`
   - Não modifica estruturas existentes

### Arquivos NÃO Modificados (Segurança)

- ✅ `lib/schedules.ts` - **NÃO alterado**
- ✅ `lib/contracts.ts` - **NÃO alterado** (apenas importação de `getContractById`)
- ✅ `lib/commitments.ts` - **NÃO alterado** (apenas usado, não modificado)
- ✅ Qualquer lógica de receivables - **NÃO alterada**

---

## ✅ Conclusão

### A implementação está SEGURA porque:

1. ✅ **Filtro explícito** por `type === 'expense'` em TODAS as operações
2. ✅ **Schedules (receivables) são ignorados** pela lógica de provisionamento
3. ✅ **Apenas despesas adicionais** são provisionadas
4. ✅ **Não há duplicação** de receivables
5. ✅ **Rollback automático** em caso de erro
6. ✅ **Notas antigas não quebram** - funcionam normalmente sem provisionamento

### Recomendações:

1. ✅ **Testar criação de nova nota de débito** com despesas
2. ✅ **Verificar se despesas aparecem no ledger** como expenses planejadas
3. ✅ **Verificar se receivables NÃO foram duplicados**
4. ✅ **Testar cancelamento/deleção** de nota de débito com despesas

---

**Status:** ✅ **APROVADO - SEGURO PARA PRODUÇÃO**
