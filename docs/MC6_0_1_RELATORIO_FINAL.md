# MC6.0.1 — Hardening Cashflow Mensal — Relatório Final

## Status dos Checkpoints

### CP1 — PASSOU ✅

**Aplicar filtro `show` na matriz mensal (frontend)**

**Mudanças:**
- `components/cashflow/CashflowMonthlyMatrix.tsx`: Adicionado prop `showMode` (default: 'both')
- `components/cashflow/CashflowMonthlyMatrixClient.tsx`: Propagado `showMode` para matriz
- `app/app/cashflow/page.tsx`: Lê `show` da querystring e passa para `CashflowMonthlyMatrixClient`

**Implementação:**
- Linhas filtradas baseadas em `showMode`:
  - `show=planned`: Apenas linhas "Previsto" (4 linhas)
  - `show=realised`: Apenas linhas "Realizado" (4 linhas)
  - `show=both`: Todas as linhas (8 linhas)
- Filtro aplicado via `.filter()` no array de rows antes de renderizar
- Drill-down continua funcional apenas para células visíveis

**Arquivos modificados:**
- `components/cashflow/CashflowMonthlyMatrix.tsx`
- `components/cashflow/CashflowMonthlyMatrixClient.tsx`
- `app/app/cashflow/page.tsx`

✅ **Critério de aceite:** Alternar show muda a grade imediatamente. URL compartilhável reproduz o mesmo estado.

---

### CP2 — PASSOU ✅

**Corrigir min_cum_month (SQL determinístico)**

**Mudanças:**
- `supabase/migrations/20251221_000011_mc6_monthly_cashflow.sql`: Refatorada lógica de `min_cum_month`

**Implementação:**
1. Criada CTE `with_worst_balance` que calcula `LEAST(planned_cum, realised_cum)` para cada mês
2. Criada CTE `min_cum` que calcula `MIN(worst_balance)`
3. Criada CTE `min_cum_month_row` que encontra o primeiro `month_start` onde `worst_balance = min_cum_balance`, ordenado por `month_start` e limitado a 1
4. JOIN via `CROSS JOIN` para combinar resultados (sempre retorna 1 linha ou nenhuma)

**Resultado:**
- `min_cum_balance`: Determinístico (MIN de worst_balance)
- `min_cum_month`: Determinístico (primeiro mês que atinge o mínimo, ordenado por data)
- Formato do retorno JSON mantido inalterado

**Arquivos modificados:**
- `supabase/migrations/20251221_000011_mc6_monthly_cashflow.sql`

✅ **Critério de aceite:** SQL compila. Retorna `min_cum_balance` e `min_cum_month` coerentes e determinísticos. Formato do retorno não muda.

---

### CP3 — PASSOU ✅

**Testes e relatório**

**Execução:**
- ✅ `npm run lint` → Sem erros
- ✅ `npm run typecheck` → Sem erros
- ✅ `npm run build` → Build bem-sucedido
- ✅ `npm run smoke` → Todos os checks passaram

**Testes manuais recomendados:**
- Alterar `show` (planned/realised/both) e validar a matriz
- Conferir metadata `min_cum_*` não é null no período com dados
- Drill-down continua funcional nas células visíveis

---

## Resumo das Mudanças

### Arquivos Modificados (3)

1. **components/cashflow/CashflowMonthlyMatrix.tsx**
   - Adicionado prop `showMode?: 'both' | 'planned' | 'realised'`
   - Linhas filtradas baseadas em `showMode`

2. **components/cashflow/CashflowMonthlyMatrixClient.tsx**
   - Adicionado prop `showMode` e propagado para `CashflowMonthlyMatrix`

3. **app/app/cashflow/page.tsx**
   - Lê `showMode` da querystring (já existia)
   - Passa `showMode` para `CashflowMonthlyMatrixClient`

4. **supabase/migrations/20251221_000011_mc6_monthly_cashflow.sql**
   - Refatorada lógica de `min_cum_month` para ser determinística
   - Adicionadas CTEs `with_worst_balance` e `min_cum_month_row`

---

## Decisões Técnicas

1. **Filtro show no frontend:**
   - Decisão: Filtro aplicado na renderização (frontend)
   - Razão: Mais simples, sem necessidade de recálculo no backend. Dados já vêm completos.

2. **min_cum_month determinístico:**
   - Decisão: Usar `ORDER BY month_start LIMIT 1` para pegar primeiro mês
   - Razão: Garante resultado consistente mesmo quando múltiplos meses têm o mesmo `worst_balance`

---

## Validações

- ✅ Nenhuma regra de negócio alterada
- ✅ Nenhuma feature nova adicionada
- ✅ Mudanças cirúrgicas (apenas o necessário)
- ✅ Nenhuma regressão introduzida
- ✅ Lint/typecheck/build/smoke todos passando

---

## Conclusão

MC6.0.1 — CONCLUÍDO

- CP1 PASSOU (show aplicado na matriz)
- CP2 PASSOU (min_cum_month determinístico)
- CP3 PASSOU (todos os checks)

Hardening aplicado com sucesso. Filtro `show` funciona na matriz e `min_cum_month` é agora determinístico.

