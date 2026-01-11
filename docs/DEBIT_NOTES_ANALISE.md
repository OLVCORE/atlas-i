# Sistema de Recebíveis e Notas de Débito - Análise e Proposta

## 📊 SITUAÇÃO ATUAL

### ✅ O que JÁ existe no sistema:

1. **Contratos (`contracts`)**
   - Tabela com campos: `title`, `description`, `total_value`, `start_date`, `end_date`, `status`
   - Vinculado a `counterparty_entity_id` (cliente)
   - Status: `draft`, `active`, `completed`, `cancelled`

2. **Contract Schedules (`contract_schedules`)**
   - Tabela que representa os recebíveis mensais do contrato
   - Campos: `contract_id`, `type` (`receivable` | `payable`), `due_date`, `amount`, `status`
   - Status: `planned`, `received`, `paid`, `cancelled`
   - Campo `linked_transaction_id` para vincular ao pagamento real no ledger

3. **Geração Automática de Schedules**
   - Ao criar um contrato com `start_date` e `end_date`, o sistema gera automaticamente os schedules mensais
   - Cada schedule representa um recebível no fluxo de caixa previsto

4. **Fluxo de Caixa**
   - O sistema já calcula fluxo de caixa baseado nos schedules
   - Schedules com status `planned` aparecem como previstos
   - Schedules com status `received`/`paid` aparecem como realizados

5. **Baixa de Recebíveis**
   - Existe sistema de baixa via `linked_transaction_id`
   - Quando um pagamento é registrado no ledger, pode ser vinculado a um schedule

### ❌ O que NÃO existe (e você precisa):

1. **Notas de Débito**
   - Tabela para armazenar notas de débito emitidas
   - Número sequencial da nota
   - Data de emissão
   - Vinculação ao `contract_schedule`
   - Status: `draft`, `sent`, `paid`, `cancelled`

2. **Índices de Reajuste**
   - Campo no contrato para definir índice (IPCA, IGPM, CDI, MANUAL, CUSTOM)
   - Cálculo automático de reajuste na data de aniversário do contrato

3. **Geração de PDF**
   - Sistema para gerar PDF da nota de débito
   - Template formatado com dados do contrato e cliente

4. **Reconciliação Automática**
   - Identificar pagamentos recebidos e dar baixa automática na nota de débito
   - Matching por valor, data e descrição

---

## 🎯 FLUXO IDEAL (Como deveria funcionar)

### 1. **Criação de Contrato**
```
1. Criar contrato com:
   - Cliente (counterparty_entity_id)
   - Valor base (ex: R$ 17.519,57 de aluguel)
   - Data início: 01/01/2025
   - Data fim: 31/12/2029 (5 anos)
   - Índice de reajuste: IPCA (anual na data de aniversário)
   
2. Sistema gera automaticamente:
   - 60 schedules mensais (5 anos × 12 meses)
   - Cada schedule = R$ 17.519,57 (ou valor proporcional se houver reajuste)
   - Datas: 01/01/2025, 01/02/2025, ..., 01/12/2029
```

### 2. **Emissão de Nota de Débito (Mensal)**
```
1. Para cada schedule com status 'planned' e due_date no mês atual:
   
2. Sistema cria nota de débito:
   - Número: ND-2025-001, ND-2025-002, etc.
   - Data emissão: hoje
   - Vencimento: due_date do schedule
   - Valor: amount do schedule (já reajustado se aplicável)
   - Descrição: "Locação - jan/2025" (baseado no contrato e período)
   
3. Status da nota: 'draft' → pode ser editada
   
4. Ao enviar para cliente:
   - Status: 'draft' → 'sent'
   - Gera PDF
   - Envia por email (futuro)
```

### 3. **Reajuste Anual (na data de aniversário)**
```
1. Sistema identifica contratos com data de aniversário:
   - Se contrato começou em 01/01/2025, aniversário é 01/01 de cada ano
   
2. Calcula novo valor base:
   - Valor anterior × (1 + índice do período)
   - Ex: R$ 17.519,57 × (1 + 0,045) = R$ 18.307,99 (se IPCA = 4,5%)
   
3. Atualiza schedules futuros:
   - Schedules já emitidos: não altera
   - Schedules futuros: recalculados com novo valor base
```

### 4. **Reconciliação (quando pagamento cai na conta)**
```
1. Transação registrada no ledger:
   - Valor: R$ 17.519,57
   - Data: 05/01/2025
   - Descrição: "Pagamento locação - jan/2025"
   
2. Sistema tenta fazer matching automático:
   - Busca notas de débito 'sent' não pagas
   - Filtra por:
     * Valor compatível (tolerância de centavos)
     * Data dentro da janela (due_date ± 30 dias)
     * Descrição similar
   
3. Se encontrar match:
   - Atualiza status da nota: 'sent' → 'paid'
   - Atualiza status do schedule: 'planned' → 'received'
   - Vincula: schedule.linked_transaction_id = transaction.id
   - Vincula: debit_note.paid_at = transaction.date
   
4. Se não encontrar:
   - Permanece como transação não reconciliada
   - Usuário pode fazer matching manual
```

### 5. **Baixa Manual (quando necessário)**
```
1. Usuário identifica transação no ledger
2. Busca nota de débito pendente
3. Faz matching manual
4. Sistema atualiza status e vincula
```

---

## 🏗️ ESTRUTURA PROPOSTA

### Migration 1: Índices de Reajuste em Contratos

```sql
-- Adicionar campos de índice de reajuste em contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS adjustment_index text CHECK (adjustment_index IN ('NONE', 'IPCA', 'IGPM', 'CDI', 'MANUAL', 'CUSTOM')),
  ADD COLUMN IF NOT EXISTS adjustment_frequency text CHECK (adjustment_frequency IN ('NONE', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  ADD COLUMN IF NOT EXISTS adjustment_percentage numeric(5,4), -- Para MANUAL ou CUSTOM
  ADD COLUMN IF NOT EXISTS last_adjustment_date date;

-- Índice para buscar contratos que precisam de reajuste
CREATE INDEX IF NOT EXISTS idx_contracts_adjustment_date 
  ON public.contracts(last_adjustment_date) 
  WHERE adjustment_index != 'NONE';
```

### Migration 2: Tabela de Notas de Débito

```sql
-- Tabela de Notas de Débito
CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_schedule_id uuid NOT NULL REFERENCES public.contract_schedules(id) ON DELETE CASCADE,
  
  -- Numeração
  number text NOT NULL, -- Ex: "ND-2025-001"
  sequence_number integer NOT NULL, -- 001, 002, etc.
  
  -- Datas
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  paid_at date, -- Data do pagamento (preenchido na reconciliação)
  
  -- Valores
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  
  -- Descrição
  description text, -- Ex: "Locação - jan/2025"
  
  -- Vinculação ao pagamento
  linked_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(workspace_id, number),
  UNIQUE(contract_schedule_id) -- Uma nota por schedule
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debit_notes_workspace_id ON public.debit_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_contract_id ON public.debit_notes(contract_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_contract_schedule_id ON public.debit_notes(contract_schedule_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_status ON public.debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_debit_notes_due_date ON public.debit_notes(due_date);
CREATE INDEX IF NOT EXISTS idx_debit_notes_number ON public.debit_notes(workspace_id, number);
```

---

## 📋 PRÓXIMOS PASSOS RECOMENDADOS

### Fase 1: Estrutura Base (MC14 - Debit Notes Foundation)
1. ✅ Migration para adicionar campos de índice em contratos
2. ✅ Migration para criar tabela `debit_notes`
3. ✅ RLS policies para `debit_notes`
4. ✅ Funções TypeScript para gerenciar notas de débito
5. ✅ Gerador de número sequencial (ND-YYYY-NNN)

### Fase 2: Geração Automática (MC14.1 - Auto Generation)
1. ✅ Função para gerar nota de débito a partir de schedule
2. ✅ Job agendado para gerar notas mensalmente
3. ✅ UI para gerar notas manualmente
4. ✅ Validações e regras de negócio

### Fase 3: Reajuste por Índice (MC14.2 - Index Adjustment)
1. ✅ Integração com API de índices (IPCA, IGPM, etc.)
2. ✅ Função para calcular reajuste anual
3. ✅ Job agendado para aplicar reajustes
4. ✅ UI para ajustar manualmente

### Fase 4: Reconciliação (MC14.3 - Auto Reconciliation)
1. ✅ Algoritmo de matching automático
2. ✅ UI para reconciliação manual
3. ✅ Dashboard de notas pendentes
4. ✅ Notificações de atraso

### Fase 5: Geração de PDF (MC14.4 - PDF Generation)
1. ✅ Template de nota de débito
2. ✅ Biblioteca de PDF (ex: @react-pdf/renderer ou puppeteer)
3. ✅ Preview e download
4. ✅ Envio por email (futuro)

---

## ❓ PERGUNTAS PARA DEFINIR

1. **Numeração das Notas:**
   - Por workspace ou global?
   - Formato preferido: `ND-2025-001` ou `2025/001`?

2. **Reajuste:**
   - Quando aplicar: na data de aniversário ou no início de cada ano?
   - Reajusta apenas valores futuros ou também pode retroagir?

3. **PDF:**
   - Template customizado ou usar biblioteca pronta?
   - Precisamos de logo/rodapé personalizado?

4. **Reconciliação:**
   - Tolerância de matching (valores e datas)?
   - Matching automático sempre ou requer aprovação?

5. **Notificações:**
   - Alertas de notas vencidas?
   - Email automático ao gerar nota?

---

## 🚀 RECOMENDAÇÃO

Sugiro começar pela **Fase 1 (Estrutura Base)** para ter o modelo de dados pronto. Depois podemos implementar as fases seguintes incrementalmente.

Você quer que eu comece implementando a Fase 1 agora?
