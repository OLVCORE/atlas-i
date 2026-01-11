# Fluxo de Importação - Melhores Práticas de Mercado

## Pesquisa: Como Grandes Plataformas Fazem

### **ContaAzul, TOTS, Organizze, Gefipe:**

**Fluxo Padrão:**
1. **Selecionar Entidade/Cliente** (primeiro)
2. **Selecionar/Criar Conta** (segundo)
3. **Upload do Arquivo** (terceiro)
4. **Preview e Validação** (quarto)
5. **Confirmação** (quinto)

### **Práticas Identificadas:**

1. **Seleção ANTES do upload:**
   - Usuário seleciona entidade primeiro
   - Depois seleciona ou cria conta
   - Sistema já sabe onde vincular antes de processar

2. **Detecção Automática de Conta:**
   - Sistema tenta detectar conta baseado no extrato (número, nome)
   - Se encontrar, sugere automaticamente
   - Se não encontrar, permite criar

3. **Criação Automática de Conta:**
   - Opção: "Criar conta automaticamente se não existir"
   - Sistema usa dados do extrato (número, banco, tipo)

4. **Suporte a OFX:**
   - Formato padrão da indústria
   - Mais confiável que CSV
   - Padronizado entre bancos

## Fluxo Recomendado (Baseado em Melhores Práticas)

### **Passo 1: Selecionar Entidade**
```
┌─────────────────────────────────┐
│ Selecione a Entidade            │
├─────────────────────────────────┤
│ [Dropdown]                      │
│ ┌─────────────────────────┐    │
│ │ XRP SOLUCOES (PJ)   ▼  │    │
│ └─────────────────────────┘    │
│                                 │
│ ✓ Você selecionou:              │
│   XRP SOLUCOES (Pessoa Jurídica)│
└─────────────────────────────────┘
```

### **Passo 2: Selecionar/Criar Conta**
```
┌─────────────────────────────────┐
│ Selecione a Conta               │
├─────────────────────────────────┤
│ [Dropdown]                      │
│ ┌─────────────────────────┐    │
│ │ Selecione uma conta  ▼ │    │
│ └─────────────────────────┘    │
│                                 │
│ Opções:                         │
│ • Nubank (Conta Corrente)       │
│ • Itaú (Conta Corrente)         │
│ • + Criar nova conta            │
│                                 │
│ ☑ Criar automaticamente se      │
│   não existir (recomendado)     │
└─────────────────────────────────┘
```

### **Passo 3: Upload do Arquivo**
```
┌─────────────────────────────────┐
│ Faça upload do extrato          │
├─────────────────────────────────┤
│ [Arraste arquivo aqui]          │
│                                 │
│ Formatos suportados:            │
│ • CSV                           │
│ • OFX (recomendado)             │
│ • Excel                         │
│                                 │
│ Ou cole o conteúdo:             │
│ [Textarea]                      │
└─────────────────────────────────┘
```

### **Passo 4: Detecção Automática (Opcional)**
```
┌─────────────────────────────────┐
│ Conta Detectada                 │
├─────────────────────────────────┤
│ ✓ Detectamos:                   │
│   Conta: 0026552-3              │
│   Banco: Itaú                   │
│   Tipo: Conta Corrente          │
│                                 │
│ [Usar esta conta] [Selecionar outra]│
└─────────────────────────────────┘
```

### **Passo 5: Preview e Validação**
```
┌─────────────────────────────────┐
│ Preview da Importação           │
├─────────────────────────────────┤
│ ✅ 45 transações novas          │
│ ⚠️ 3 duplicatas (serão ignoradas)│
│ ❌ 1 erro                       │
│                                 │
│ [Tabela com preview]            │
│                                 │
│ Opções:                         │
│ ☑ Pular duplicatas              │
│ ☑ Atualizar saldo               │
└─────────────────────────────────┘
```

## Implementação Recomendada

### **Arquitetura Simplificada:**

1. **Ordem de Seleção:**
   - Entidade → Conta → Upload (nesta ordem)
   - Não permite upload sem selecionar

2. **Detecção de Conta:**
   - Após upload, tentar detectar conta pelo número/banco
   - Se encontrar, sugerir
   - Se não, permitir criar ou selecionar manualmente

3. **Criação Automática:**
   - Checkbox: "Criar conta automaticamente"
   - Sistema cria conta usando dados do extrato
   - Nome: extraído do extrato (ou padrão)
   - Tipo: detectado automaticamente

4. **Suporte Multi-Formato:**
   - Prioridade: OFX (se disponível)
   - Fallback: CSV/Excel
   - Detecção automática do formato

## Vantagens desta Abordagem

✅ **Fluxo claro** - Usuário sabe exatamente o que fazer  
✅ **Menos erros** - Vincula antes de processar  
✅ **Detecção inteligente** - Facilita quando possível  
✅ **Criação automática** - Não trava se conta não existe  
✅ **Padrão do mercado** - Usuários já conhecem  
