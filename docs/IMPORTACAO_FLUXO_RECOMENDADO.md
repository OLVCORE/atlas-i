# Fluxo de Importação Recomendado - Resposta ao Usuário

## Resposta Direta às Perguntas

### **1. Qual o caminho para importar?**

**Fluxo Recomendado (baseado em ContaAzul, TOTS, etc):**

```
1. Selecionar Entidade (PF ou PJ)
   ↓
2. Selecionar/Criar Conta
   ↓
3. Upload do Arquivo (CSV/OFX/Excel)
   ↓
4. Preview e Validação
   ↓
5. Confirmação e Importação
```

### **2. Como selecionar entidade e conta?**

**Ordem CORRETA:**
1. **PRIMEIRO:** Selecionar entidade (dropdown)
2. **SEGUNDO:** Selecionar conta OU criar nova
3. **TERCEIRO:** Fazer upload do arquivo

**Por quê?**
- Sistema já sabe onde vincular ANTES de processar
- Evita erros de vinculação
- Permite criação automática de conta se necessário
- Padrão do mercado (ContaAzul, TOTS, etc)

### **3. O sistema detecta automaticamente qual conta?**

**Sim, mas com nuance:**

**Opção A: Detecção Automática (Recomendado)**
- Sistema analisa o extrato
- Detecta número da conta, banco, tipo
- Busca conta existente com mesmo número
- Se encontrar: sugere automaticamente
- Se não encontrar: permite criar

**Opção B: Seleção Manual**
- Usuário seleciona conta manualmente
- Útil quando há múltiplas contas do mesmo banco

**Opção C: Criação Automática**
- Checkbox: "Criar conta se não existir"
- Sistema cria usando dados do extrato
- Nome: extraído do extrato
- Tipo: detectado automaticamente

### **4. Precisa criar novas contas?**

**Depende da configuração:**

- **Se checkbox "Criar automaticamente" estiver marcado:**
  - Sistema cria conta automaticamente
  - Usa dados do extrato (número, banco, tipo)
  - Nome padrão: "[Banco] - [Tipo]" (ex: "Itaú - Conta Corrente")

- **Se checkbox estiver desmarcado:**
  - Usuário precisa selecionar conta existente
  - Ou criar manualmente antes

### **5. Como funciona na prática?**

**Exemplo 1: Conta já existe**
```
1. Usuário seleciona: "XRP SOLUCOES" (PJ)
2. Sistema mostra contas: "Itaú 2961", "Nubank", etc
3. Usuário seleciona: "Itaú 2961"
4. Upload do extrato
5. Sistema detecta: conta 0026552-3 = "Itaú 2961" ✓
6. Preview e confirmação
```

**Exemplo 2: Conta não existe (criação automática)**
```
1. Usuário seleciona: "XRP SOLUCOES" (PJ)
2. Sistema mostra contas: "Nubank", "XP Investimentos"
3. Usuário marca: ☑ Criar automaticamente
4. Upload do extrato do Itaú
5. Sistema detecta: conta 0026552-3 não existe
6. Sistema cria: "Itaú - Conta Corrente" automaticamente
7. Preview e confirmação
```

**Exemplo 3: Múltiplas contas do mesmo banco**
```
1. Usuário seleciona: "MARCOS FRANCISCO" (PF)
2. Sistema mostra: "Itaú PF 6225", "Itaú PJ 2961"
3. Upload do extrato
4. Sistema detecta: conta 12447-5
5. Sistema sugere: "Itaú PF 6225" (match por número)
6. Usuário confirma ou seleciona outra
```

## Interface Recomendada

### **Tela de Importação:**

```
┌─────────────────────────────────────────────┐
│ Importar Extrato Bancário                   │
├─────────────────────────────────────────────┤
│                                             │
│ Passo 1: Selecionar Entidade *             │
│ ┌───────────────────────────────────────┐  │
│ │ [XRP SOLUCOES (PJ)              ▼]   │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Passo 2: Selecionar Conta                  │
│ ┌───────────────────────────────────────┐  │
│ │ [Selecione uma conta             ▼]   │  │
│ └───────────────────────────────────────┘  │
│   Contas disponíveis:                       │
│   • Itaú 2961 - 0026552-3                  │
│   • Nubank - Conta Principal                │
│   • + Criar nova conta                      │
│                                             │
│ ☑ Criar conta automaticamente se não       │
│   existir (usando dados do extrato)        │
│                                             │
│ Passo 3: Upload do Arquivo                 │
│ ┌───────────────────────────────────────┐  │
│ │                                       │  │
│ │    [Arraste arquivo aqui ou clique]  │  │
│ │                                       │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Formatos suportados: CSV, OFX, Excel       │
│                                             │
│ [Cancelar] [Avançar →]                     │
└─────────────────────────────────────────────┘
```

### **Após Upload (Preview):**

```
┌─────────────────────────────────────────────┐
│ Preview da Importação                       │
├─────────────────────────────────────────────┤
│                                             │
│ Conta Detectada:                            │
│ ✓ Itaú - 0026552-3 (Agência 2961)          │
│ [Usar esta] [Selecionar outra]             │
│                                             │
│ Resumo:                                     │
│ ✅ 45 transações novas                      │
│ ⚠️ 3 duplicatas (serão ignoradas)          │
│ ❌ 1 erro                                   │
│                                             │
│ [Tabela com preview]                        │
│                                             │
│ Opções:                                     │
│ ☑ Pular duplicatas                          │
│ ☑ Atualizar saldo automaticamente          │
│                                             │
│ [← Voltar] [Confirmar Importação]          │
└─────────────────────────────────────────────┘
```

## Resumo

**Fluxo:**
1. Selecionar Entidade (obrigatório)
2. Selecionar/Criar Conta (opcional com criação automática)
3. Upload Arquivo
4. Detecção automática de conta (opcional)
5. Preview
6. Confirmação

**Detecção:**
- Sistema tenta detectar conta pelo número
- Sugere se encontrar
- Permite criar se não encontrar (com checkbox)

**Criação:**
- Automática: checkbox "Criar se não existir"
- Manual: usuário cria antes
- Híbrida: sistema sugere, usuário confirma
