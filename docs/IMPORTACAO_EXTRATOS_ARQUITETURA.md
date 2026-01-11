# Arquitetura: Importação Automática de Extratos Bancários

## Visão Geral

Sistema de importação de extratos via CSV/planilha para:
- **Contas Correntes** (PF e PJ)
- **Cartões de Crédito** (PF e PJ) 
- **Investimentos** (CDB, etc)

## Objetivos

1. **Atualização automática** sem digitação manual
2. **Detecção de duplicatas** - não criar transações já existentes
3. **Reconciliação automática** - matching por data, valor, descrição
4. **Suporte multi-moeda** - transações em dólar convertidas para real
5. **Assertividade** - validação e preview antes de confirmar

---

## Arquitetura Proposta

### 1. **Página de Importação** (`/app/import`)

**Abordagem:** Página dedicada com múltiplas abas/seções

```
┌─────────────────────────────────────────────────┐
│  Importação de Extratos                         │
├─────────────────────────────────────────────────┤
│  [Conta Corrente] [Cartão de Crédito] [Invest.] │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 1. Selecione o arquivo CSV                │ │
│  │    [Escolher arquivo] ou [Colar texto]    │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 2. Preview e Validação                    │ │
│  │    [Tabela com preview das transações]    │ │
│  │    ✅ 45 novas transações                 │ │
│  │    ⚠️ 3 possíveis duplicatas              │ │
│  │    ❌ 1 erro de formato                   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 3. Opções                                 │ │
│  │    ☑ Atualizar saldo da conta            │ │
│  │    ☑ Criar transações automaticamente    │ │
│  │    ☑ Ignorar duplicatas                  │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [Cancelar] [Importar 45 transações]           │
└─────────────────────────────────────────────────┘
```

### 2. **Estrutura de Dados**

#### **Conta Corrente**
```typescript
type ContaCorrenteRow = {
  data: string // DD/MM/YYYY
  lancamento: string // Descrição
  razao_social?: string // Nome da entidade
  cpf_cnpj?: string // Documento
  valor: number // Valor em R$ (negativo = saída, positivo = entrada)
  saldo?: number // Saldo no dia
}
```

#### **Cartão de Crédito**
```typescript
type CartaoCreditoRow = {
  data: string // DD/MM/YYYY
  descricao: string
  valor: number // Valor em R$
  // Para internacionais:
  moeda_local?: string // BRL200,00 ou $20,00
  moeda_global?: string // US$20,00
  cotacao?: number // R$5,76
  valor_final?: number // R$115,20
}

type CartaoCreditoHeader = {
  numero_cartao: string
  data_fechamento: string
  data_vencimento: string
  total_fatura: number
}
```

#### **Investimento (CDB)**
```typescript
type InvestimentoRow = {
  data: string
  historico: string
  valor: number
  iof?: number
  ir?: number
  valor_creditado?: number
  valor_aplicacao?: number
  remuneracao?: number
  rentabilidade_periodo?: number
  data_aplicacao?: string
  data_vencimento?: string
  n_operacao?: string
}
```

### 3. **Fluxo de Importação**

```
┌─────────────┐
│ Upload CSV  │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Parser CSV       │
│ - Detectar tipo  │
│ - Validar formato│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Normalização     │
│ - Datas          │
│ - Valores        │
│ - Moedas         │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Detecção         │
│ Duplicatas       │
│ - Por: data +    │
│   valor + desc   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Preview          │
│ - Novas: 45      │
│ - Duplicadas: 3  │
│ - Erros: 1       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Confirmação      │
│ - Criar trans.   │
│ - Atualizar saldo│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Importação       │
│ - Batch insert   │
│ - Recalcular     │
│   saldos         │
└──────────────────┘
```

### 4. **Detecção de Duplicatas**

**Estratégia:**
```typescript
function detectarDuplicatas(novasTransacoes: Transaction[], existentes: Transaction[]) {
  return novasTransacoes.map(nova => {
    // Matching por:
    // 1. Data (tolerância ±2 dias)
    // 2. Valor absoluto (tolerância ±0,01)
    // 3. Descrição similar (fuzzy match)
    
    const duplicata = existentes.find(existente => 
      Math.abs(diferencaDias(nova.date, existente.date)) <= 2 &&
      Math.abs(Math.abs(nova.amount) - Math.abs(existente.amount)) < 0.01 &&
      similaridadeTexto(nova.description, existente.description) > 0.8
    )
    
    return {
      ...nova,
      isDuplicata: !!duplicata,
      duplicataId: duplicata?.id
    }
  })
}
```

### 5. **Conversão de Moedas**

Para transações internacionais em cartões:
```typescript
function converterMoeda(
  valorOriginal: number,
  moedaOriginal: string, // 'USD', 'BRL'
  cotacao: number,
  valorFinal?: number // Se já convertido pelo banco
) {
  if (valorFinal !== undefined) {
    // Banco já forneceu valor convertido
    return valorFinal
  }
  
  if (moedaOriginal === 'USD' || moedaOriginal === '$') {
    return valorOriginal * cotacao
  }
  
  return valorOriginal // Já em BRL
}
```

### 6. **Atualização de Saldos**

**Para Conta Corrente:**
- Usar o último saldo do extrato
- Atualizar `opening_balance` e `opening_balance_date`
- Criar transações para diferenças (se necessário)

**Para Cartão de Crédito:**
- Não atualiza saldo diretamente
- Cria transações de `expense` vinculadas ao cartão
- No vencimento, cria uma transaction de pagamento da fatura total

**Para Investimentos:**
- Atualiza saldo do investimento
- Cria transações de rendimento (se houver)

### 7. **Estrutura de Arquivos**

```
lib/
  import/
    parsers/
      conta-corrente-parser.ts
      cartao-credito-parser.ts
      investimento-parser.ts
    detectors/
      duplicate-detector.ts
    converters/
      currency-converter.ts
    validators/
      transaction-validator.ts
    import-extract.ts (função principal)

app/
  app/
    import/
      page.tsx (página principal)
      components/
        ImportExtractDialog.tsx
        ExtractPreviewTable.tsx
        ExtractValidationSummary.tsx
        ImportTypeTabs.tsx

components/
  import/
    ExtractUploadZone.tsx
    ExtractPreviewTable.tsx
    DuplicateWarning.tsx
```

### 8. **API Routes**

```
POST /api/import/extract
Body: {
  type: 'checking' | 'credit_card' | 'investment'
  accountId: string
  csvData: string
  options: {
    updateBalance: boolean
    createTransactions: boolean
    ignoreDuplicates: boolean
  }
}

Response: {
  preview: {
    total: number
    novas: number
    duplicadas: number
    erros: number
    transactions: TransactionPreview[]
  }
}

POST /api/import/extract/confirm
Body: {
  importId: string
  transactions: Transaction[]
}

Response: {
  created: number
  skipped: number
  errors: Error[]
  balanceUpdated: boolean
}
```

### 9. **Validações**

1. **Formato do CSV:**
   - Validar colunas obrigatórias
   - Validar tipos de dados
   - Validar formato de datas

2. **Transações:**
   - Valor não pode ser zero
   - Data não pode ser futura (ou permitir com confirmação)
   - Descrição não pode ser vazia

3. **Saldos:**
   - Saldo final do extrato deve bater com saldo calculado
   - Permitir diferenças pequenas (< R$ 1,00)

### 10. **Preview e Confirmação**

**Tabela de Preview:**
```
┌──────────┬──────────────────────────┬──────────────┬────────┬──────────────┐
│ Status   │ Descrição                │ Data         │ Valor  │ Ação         │
├──────────┼──────────────────────────┼──────────────┼────────┼──────────────┤
│ ✅ Novo  │ PIX RECEBIDO BOTEQUI     │ 16/12/2025   │ 10.000 │ Criar        │
│ ⚠️ Dupl. │ PIX ENVIADO CILENE       │ 23/12/2025   │ -350   │ Ignorar      │
│ ✅ Novo  │ BOLETO PAGO ITAU         │ 15/12/2025   │ -3041  │ Criar        │
│ ❌ Erro  │ SALDO ANTERIOR           │ 11/12/2025   │ -      │ Pular        │
└──────────┴──────────────────────────┴──────────────┴────────┴──────────────┘
```

### 11. **Tratamento de Erros**

- **Linhas inválidas:** Logar e continuar
- **Transações duplicadas:** Marcar e permitir escolha
- **Saldos divergentes:** Alertar e permitir ajuste manual
- **Moedas não suportadas:** Converter usando cotação fornecida

### 12. **Fluxo de Cartão de Crédito**

1. **Importar fatura:**
   - Criar transações de `expense` para cada lançamento
   - Vincular ao cartão
   - Data = data do lançamento

2. **No vencimento:**
   - Criar uma transaction de `expense` com valor = total da fatura
   - Data = data de vencimento
   - Descrição = "Pagamento fatura [mês/ano]"
   - Vinculada à conta corrente (pagamento)

3. **No fluxo de caixa:**
   - Mostrar projeção no dia do vencimento
   - Valor = total da fatura

---

## Recomendação Final

### **Fase 1: MVP (Manual + Preview)**
1. Upload de CSV
2. Parser básico
3. Preview em tabela
4. Confirmação manual
5. Criação de transações em batch

### **Fase 2: Detecção de Duplicatas**
1. Algoritmo de matching
2. Marcação automática
3. Opção de ignorar/criar

### **Fase 3: Atualização Automática de Saldos**
1. Detectar saldo final do extrato
2. Comparar com saldo calculado
3. Atualizar automaticamente (com confirmação)

### **Fase 4: Reconciliação Avançada**
1. Matching com transações existentes
2. Sugestões de reconciliação
3. Ajustes automáticos

---

## Vantagens desta Arquitetura

✅ **Flexível:** Suporta múltiplos formatos de extrato  
✅ **Segura:** Preview antes de confirmar  
✅ **Inteligente:** Detecção automática de duplicatas  
✅ **Rápida:** Batch insert para performance  
✅ **Auditável:** Log de todas as importações  
✅ **Extensível:** Fácil adicionar novos formatos  

---

## Próximos Passos

1. Criar estrutura de pastas e arquivos base
2. Implementar parser para conta corrente (Itaú)
3. Implementar parser para cartão de crédito (Itaú)
4. Implementar detector de duplicatas
5. Criar UI de preview e confirmação
6. Integrar com sistema de transações existente
