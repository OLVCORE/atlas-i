# Proposta: Melhoria na Atualização de Saldos

## Problema Atual

1. **Open Finance** - Não está mais disponível (R$ 2.500/mês muito caro)
2. **Scraping** - Serviço não está funcionando
3. **UX Confusa** - Não está claro como atualizar saldos de:
   - Contas correntes
   - Investimentos  
   - Cartões de crédito
4. **Falta de Ferramentas** - Não há opção clara para:
   - Atualização manual de saldos
   - Importação via planilha
   - Ajuste de saldos

## Solução Proposta

### 1. Ajuste de Saldo Manual (Quick Fix)

**Para cada conta:**
- Botão "Atualizar Saldo" na lista de contas
- Modal simples com:
  - Data do saldo
  - Novo saldo
  - Descrição opcional (ex: "Ajuste conforme extrato de 01/02/2025")
- Ao confirmar, cria uma transaction de ajuste (type: 'adjustment') que reconcilia o saldo

**UX:**
```
[Conta Corrente - Nubank]  Saldo: R$ 5.000,00  [Atualizar Saldo] [Ver Detalhes]
```

### 2. Importação em Massa via Planilha (Excel/CSV)

**Formato sugerido:**
```csv
Conta,Data,Saldo,Descrição
Nubank,2025-02-01,5000.00,Extrato de fevereiro
Itau,2025-02-01,15000.00,Saldo corrente
XP Investimentos,2025-02-01,50000.00,Posição consolidada
```

**Funcionalidades:**
- Upload de arquivo CSV/Excel
- Preview antes de confirmar
- Validação de contas existentes
- Opção de criar contas que não existem
- Preview de diferenças (saldo atual vs novo saldo)

### 3. Atualização de Cartões de Crédito

**Abordagem similar:**
- Saldo devedor do cartão = saldo atual
- Botão "Atualizar Saldo Devedor"
- Importação de faturas via CSV:
  ```csv
  Cartão,Data,Saldo Devedor,Valor da Fatura
  Nubank,2025-02-01,3000.00,3000.00
  Inter,2025-02-01,1500.00,1500.00
  ```

### 4. Dashboard de Sincronização

**Página dedicada: `/app/accounts/sync`**
- Visão consolidada de todas as contas
- Status: "Atualizado", "Desatualizado" (última atualização > 7 dias)
- Ações em massa:
  - "Atualizar Todas" (abre modal para entrada rápida)
  - "Importar Planilha"
  - "Download Template"

## Modelo de Dados

### Transaction de Ajuste
Adicionar tipo `adjustment` às transactions:
- `type: 'adjustment'`
- `amount`: diferença entre saldo atual e novo saldo
- `description`: "Ajuste manual - [data]" ou descrição do usuário
- `metadata`: JSON com `previous_balance`, `new_balance`, `adjustment_date`

### Migration Necessária
```sql
-- Adicionar tipo 'adjustment' ao enum de transaction types
ALTER TABLE transactions 
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check 
  CHECK (type IN ('income', 'expense', 'transfer', 'adjustment'));
```

## UX/UI Melhorias

### Página de Contas (`/app/accounts`)
1. **Coluna "Última Atualização"** na tabela
2. **Indicador visual** (badge verde/amarelo/vermelho) se está atualizado
3. **Botão "Atualizar Saldo"** em cada linha
4. **Ações em massa** no topo:
   - [Atualizar Selecionadas]
   - [Importar Planilha]
   - [Download Template]

### Modal de Atualização
```
┌─────────────────────────────────┐
│ Atualizar Saldo - Nubank        │
├─────────────────────────────────┤
│ Data: [01/02/2025]              │
│ Saldo Atual: R$ 4.500,00        │
│ Novo Saldo: [5.000,00]          │
│ Diferença: +R$ 500,00           │
│                                 │
│ Descrição (opcional):           │
│ [Extrato de fevereiro/2025]     │
│                                 │
│         [Cancelar] [Confirmar]  │
└─────────────────────────────────┘
```

### Página de Importação
```
┌─────────────────────────────────┐
│ Importar Saldos                 │
├─────────────────────────────────┤
│ 1. Selecione o arquivo          │
│    [Escolher arquivo CSV/Excel] │
│                                 │
│ 2. Preview                       │
│    [Tabela com preview]         │
│                                 │
│ 3. Opções                        │
│    ☑ Criar contas inexistentes  │
│    ☐ Ignorar linhas com erro    │
│                                 │
│         [Cancelar] [Importar]   │
└─────────────────────────────────┘
```

## Referências (Como grandes plataformas fazem)

### ContaAzul
- Botão "Atualizar Saldo" em cada conta
- Importação de extratos bancários (CSV)
- Reconciliação manual
- Indicador de última atualização

### Contabilizei
- Importação de extratos
- Ajuste manual de saldo
- Dashboard de sincronização
- Templates para download

### Organizze
- Upload de extratos (PDF/CSV)
- Ajuste manual simples
- Preview antes de confirmar

## Implementação Sugerida (Fases)

### Fase 1: Ajuste Manual (Prioritário - UX)
1. Adicionar botão "Atualizar Saldo" na tabela de contas
2. Criar modal de atualização
3. Implementar transaction de ajuste
4. Atualizar cálculo de saldos

### Fase 2: Indicadores e Dashboard
1. Coluna "Última Atualização"
2. Badges de status (atualizado/desatualizado)
3. Página de sincronização `/app/accounts/sync`

### Fase 3: Importação
1. Upload de CSV/Excel
2. Parser e validação
3. Preview e confirmação
4. Template para download

### Fase 4: Cartões
1. Aplicar mesma lógica para cartões
2. Importação de faturas
3. Reconciliação de faturas vs transações
