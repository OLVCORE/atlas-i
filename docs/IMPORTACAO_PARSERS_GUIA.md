# Guia: Como Adicionar Novo Parser de Extrato

## Visão Geral

Para adicionar suporte a um novo banco ou formato de extrato, você precisa criar um parser que implementa a interface `ExtractParser` e converte o formato específico para o formato normalizado universal.

## Passo a Passo

### 1. Criar o Parser

Crie um novo arquivo em `lib/import/parsers/`:

```typescript
// lib/import/parsers/santander-checking.ts
import { BaseParser } from './base'
import type { ParseResult, NormalizedExtract } from '../types'

export class SantanderCheckingParser extends BaseParser {
  name = 'santander_checking_csv'
  supportedFormat = 'santander_checking_csv'
  extractType = 'checking' as const
  
  canParse(data: string | string[]): boolean {
    // Implementar lógica para detectar se é extrato Santander
    const lines = Array.isArray(data) ? data : data.split('\n')
    const firstLines = lines.slice(0, 10).join('\n').toUpperCase()
    
    // Indicadores específicos do Santander
    return firstLines.includes('SANTANDER') && 
           firstLines.includes('EXTRATO')
  }
  
  async parse(data: string | string[]): Promise<ParseResult> {
    // 1. Parsear cabeçalho (nome, conta, período, etc)
    // 2. Parsear transações (cada linha)
    // 3. Normalizar para formato universal
    // 4. Retornar NormalizedExtract
  }
}
```

### 2. Normalizar os Dados

Converta o formato específico para o formato normalizado:

```typescript
// Exemplo: Parsear uma linha do Santander
private parseTransactionLine(line: string, rowNumber: number): NormalizedTransaction {
  // Formato Santander: Data | Descrição | Débito | Crédito | Saldo
  const parts = line.split('\t')
  
  return {
    date: this.normalizeDate(parts[0]), // DD/MM/YYYY → YYYY-MM-DD
    description: parts[1]?.trim(),
    amount: this.normalizeAmount(parts[2] || parts[3]), // Débito (negativo) ou Crédito (positivo)
    currency: 'BRL',
    type: this.detectTransactionType(parts[1], parseFloat(parts[2] || parts[3])),
    originalRow: rowNumber,
    originalData: { linha: line }
  }
}
```

### 3. Registrar o Parser

Adicione o parser ao registry em `lib/import/parsers/registry.ts`:

```typescript
import { SantanderCheckingParser } from './santander-checking'

export function registerAllParsers() {
  parserRegistry.register(new ItauCheckingParser())
  parserRegistry.register(new SantanderCheckingParser()) // ← Novo parser
  // ...
}
```

### 4. Testar

Crie testes para validar:
- Detecção correta do formato
- Parsing de cabeçalho
- Parsing de transações
- Normalização correta

## Estrutura do Formato Normalizado

Todos os parsers devem converter para este formato:

```typescript
type NormalizedExtract = {
  type: 'checking' | 'credit_card' | 'investment'
  header: {
    accountNumber?: string
    accountName?: string
    branch?: string
    bank?: string
    periodStart?: string // YYYY-MM-DD
    periodEnd?: string
    lastUpdate?: string
  }
  transactions: NormalizedTransaction[]
  balances: NormalizedBalance[]
  metadata: {
    sourceFormat: string
    parserVersion: string
    importedAt: string
    totalTransactions: number
    totalAmount: number
    finalBalance?: number
  }
}
```

## Exemplos de Formatos

### Itaú (já implementado)
- CSV com tabs ou vírgulas
- Estrutura: Data | Lançamento | Razão Social | CPF/CNPJ | Valor | Saldo

### Santander (exemplo)
- CSV/XLSX
- Estrutura: Data | Descrição | Débito | Crédito | Saldo

### BTG (exemplo)
- CSV
- Estrutura: Data | Descrição | Categoria | Valor | Saldo

### XP (exemplo)
- CSV
- Estrutura: Data | Descrição | Tipo | Valor | Saldo

### Mercado Livre (exemplo)
- CSV
- Estrutura: Data | Descrição | Valor | Saldo

## Dicas

1. **Use BaseParser**: Herde de `BaseParser` para ter métodos úteis como `normalizeDate()`, `normalizeAmount()`, etc.

2. **Detecção Robusta**: O método `canParse()` deve ser específico o suficiente para não dar falso positivo

3. **Tratamento de Erros**: Retorne erros específicos para ajudar o usuário

4. **Preservar Dados Originais**: Salve dados originais em `originalData` para debug

5. **Teste com Dados Reais**: Use extratos reais (sem dados sensíveis) para testar

## Checklist

- [ ] Parser criado estendendo `BaseParser`
- [ ] Método `canParse()` implementado
- [ ] Método `parse()` implementado
- [ ] Dados normalizados corretamente
- [ ] Parser registrado no registry
- [ ] Testado com extratos reais
- [ ] Documentado formato suportado
