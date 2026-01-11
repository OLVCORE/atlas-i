# MC14: Notas de Débito - Progresso da Implementação

## ✅ CONCLUÍDO (Fases 1-5)

### Fase 1: Migration - Estrutura Base ✅
- **Arquivo:** `supabase/migrations/20250124_000001_mc14_debit_notes.sql`
- **Implementado:**
  - ✅ Campos de índice de reajuste em `contracts`:
    - `adjustment_index` (NONE, IPCA, IGPM, CDI, MANUAL, CUSTOM)
    - `adjustment_frequency` (NONE, MONTHLY, QUARTERLY, YEARLY)
    - `adjustment_percentage` (para MANUAL/CUSTOM)
    - `last_adjustment_date`
  - ✅ Tabela `debit_notes`:
    - Numeração sequencial (ND-YYYY-NNN)
    - Status (draft, sent, paid, cancelled)
    - Vinculação a contrato e transação
  - ✅ Tabela `debit_note_items`:
    - Relacionamento N:N entre notas e schedules
    - Permite múltiplos itens por nota
  - ✅ RLS policies completas para ambas as tabelas
  - ✅ Índices otimizados

### Fase 2: Funções TypeScript - CRUD ✅
- **Arquivo:** `lib/debit-notes.ts`
- **Implementado:**
  - ✅ `generateNextDebitNoteNumber()` - Gera número sequencial (ND-YYYY-NNN)
  - ✅ `createDebitNote()` - Cria nota a partir de múltiplos schedules
  - ✅ `listDebitNotes()` - Lista notas com filtros
  - ✅ `getDebitNoteById()` - Busca nota com itens
  - ✅ `updateDebitNoteStatus()` - Atualiza status da nota
  - ✅ `reconcileDebitNote()` - Reconcilia nota com transação
  - ✅ `findMatchingDebitNotes()` - Matching automático:
    - Por valor total (tolerância 0.01 centavos)
    - Por data (tolerância 2 dias)
    - Status = 'sent' e não paga

## 📋 PENDENTE (Fases 6-9)

### Fase 6: UI - Página /app/debit-notes
- [ ] Criar página de listagem
- [ ] Tabela com notas de débito
- [ ] Filtros (status, contrato, ano)
- [ ] Cards de resumo (pendentes, enviadas, pagas)

### Fase 7: UI - Dialog Gerar Nota
- [ ] Dialog para selecionar contrato
- [ ] Lista de schedules disponíveis (checkbox múltipla seleção)
- [ ] Preview do total
- [ ] Campo descrição opcional
- [ ] Botão gerar

### Fase 8: UI - Reconciliação Manual
- [ ] Dialog de reconciliação
- [ ] Buscar transações não reconciliadas
- [ ] Sugerir matches automáticos
- [ ] Vincular manualmente

### Fase 9: Geração de PDF
- [ ] Template padrão (Woocommerce/práticas de mercado)
- [ ] Biblioteca de PDF (puppeteer ou @react-pdf/renderer)
- [ ] Preview HTML
- [ ] Download PDF
- [ ] Dados: número, datas, itens, totais, cliente

## 🔄 PRÓXIMOS PASSOS

1. **Executar Migration SQL**
   - Executar `supabase/migrations/20250124_000001_mc14_debit_notes.sql` no Supabase

2. **Validar Funções TypeScript**
   - Testar `generateNextDebitNoteNumber()`
   - Testar `createDebitNote()` com múltiplos schedules
   - Testar `findMatchingDebitNotes()` com tolerância de 2 dias

3. **Criar UI**
   - Começar pela página de listagem (Fase 6)
   - Depois dialog de geração (Fase 7)
   - Por último reconciliação (Fase 8)

4. **PDF (Fase 9)**
   - Escolher biblioteca (puppeteer ou react-pdf)
   - Criar template
   - Implementar preview e download

## 📝 OBSERVAÇÕES TÉCNICAS

### Numeração
- Formato: `ND-YYYY-NNN` (ex: `ND-2026-001`)
- Sequencial por workspace e ano
- Usa relógio do sistema para determinar ano

### Reconciliação
- **Tolerância de valor:** 0.01 centavos
- **Tolerância de data:** 2 dias (due_date ± 2 dias)
- **Matching:** Por valor TOTAL da nota (soma dos itens)
- **Status:** Apenas notas 'sent' não pagas são consideradas

### Múltiplos Itens
- Uma nota pode ter múltiplos schedules
- Valor total = soma dos valores dos schedules
- Todos os schedules são atualizados quando nota é paga

### Reajuste
- Campos adicionados em contratos
- Reajuste aplicado na data de aniversário do contrato
- Implementação do cálculo de reajuste (Fase futura)
