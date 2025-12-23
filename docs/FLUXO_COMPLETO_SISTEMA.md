# 🔄 Fluxo Completo do Sistema ATLAS-i

## 📋 Visão Geral

Este documento explica **COMO TUDO SE CONECTA** no sistema, seguindo a perspectiva do usuário.

---

## 🎯 Ordem de Operação (Fluxo Natural)

### 1️⃣ **CRIAR ENTIDADE** (OBRIGATÓRIO PRIMEIRO)

**Onde:** `/app/entities`

**O que fazer:**
- Criar uma **Pessoa Física (PF)** ou **Pessoa Jurídica (PJ)**
- Informar CPF/CNPJ, nome, endereço, etc.
- O sistema pode enriquecer automaticamente os dados via BrasilAPI

**Por que primeiro?**
- **TUDO** no sistema precisa estar vinculado a uma entidade
- Contas bancárias pertencem a entidades
- Transações pertencem a entidades
- Cartões pertencem a entidades
- Scrapers são configurados por entidade

**Resultado:** Você tem uma entidade no sistema (ex: "João Silva - PF" ou "Empresa XYZ Ltda - PJ")

---

### 2️⃣ **CRIAR CONTAS** (OPCIONAL, MAS RECOMENDADO)

**Onde:** `/app/accounts`

**O que fazer:**
- Criar contas bancárias vinculadas à entidade criada no passo 1
- Tipos: Conta Corrente, Investimento, Outro
- Informar saldo inicial (opcional)

**Por que?**
- Organiza melhor as transações
- Facilita conciliação
- Melhora o fluxo de caixa
- **Mas não é obrigatório** - o sistema pode criar contas automaticamente ao importar

**Resultado:** Você tem contas cadastradas para cada entidade

---

### 3️⃣ **IMPORTAR DADOS** (DUAS OPÇÕES)

#### Opção A: **Importar Planilhas (CSV)** 📊

**Onde:** `/app/import`

**Fluxo:**
1. **Selecionar arquivo CSV** (extrato bancário, cartão, etc.)
2. **Sistema faz preview** automático dos dados
3. **Escolher ENTIDADE** (PF ou PJ) - **OBRIGATÓRIO**
4. **Escolher CONTA** (opcional - pode criar automaticamente)
5. **Configurar opções:**
   - Pular duplicados? (recomendado: SIM)
   - Conciliação automática? (opcional)
6. **Importar**

**O que acontece:**
- Sistema importa transações
- Vincula à entidade escolhida
- Vincula à conta (ou cria nova)
- **Faz baixa automática de parcelas de cartão** (se detectar pagamentos)
- **Atualiza fluxo de caixa** automaticamente

#### Opção B: **Configurar Scrapers Bancários** 🤖

**Onde:** `/app/scrapers`

**Fluxo:**
1. **Escolher ENTIDADE** (PF ou PJ) - **OBRIGATÓRIO PRIMEIRO**
2. **Escolher BANCO** (Itaú, Santander, BTG, Mercado Pago)
3. **Informar credenciais:**
   - CPF/CNPJ ou usuário
   - Senha do internet banking
   - Secret 2FA (se necessário)
4. **Escolher CONTA** (opcional - pode criar automaticamente)
5. **Configurar frequência de sincronização**
6. **Conectar**

**O que acontece:**
- Sistema salva credenciais (criptografadas)
- Pode sincronizar manualmente ou aguardar sincronização automática
- Ao sincronizar, extrai transações do banco
- Importa automaticamente (mesma lógica da Opção A)
- **Faz baixa automática de parcelas**
- **Atualiza fluxo de caixa**

---

## 🔗 Como Tudo Se Conecta

### Hierarquia de Dados

```
Workspace (Seu ambiente)
  └── Entidades (PF ou PJ)
      ├── Contas Bancárias
      │   └── Transações (importadas via CSV ou Scraper)
      ├── Cartões de Crédito
      │   ├── Compras
      │   └── Parcelas (vinculadas ao fluxo de caixa)
      ├── Compromissos Financeiros
      ├── Contratos
      └── Conexões de Scrapers (vinculadas à entidade)
```

### Fluxo de Dados

#### **Quando você importa uma planilha CSV:**

```
CSV → Parser → Validação → Entidade escolhida → Conta (ou cria nova) → Transações → 
→ Detecção de pagamentos de cartão → Baixa de parcelas → Atualização de fluxo de caixa
```

#### **Quando você configura um scraper:**

```
Scraper → Login no banco → Extração de transações → Importação automática → 
→ Mesmo fluxo acima (como se fosse CSV)
```

#### **Como as parcelas de cartão funcionam:**

1. **Você importa uma compra parcelada** (via CSV ou scraper)
2. Sistema **cria automaticamente**:
   - Uma "compra" no cartão
   - Várias "parcelas" (ex: Parcela 1/10, 2/10, etc.)
3. Parcelas aparecem no **fluxo de caixa** como despesas futuras
4. Quando você **importa o pagamento da fatura** (via CSV ou scraper):
   - Sistema **detecta automaticamente** o pagamento
   - **Baixa as parcelas pagas** (marca como "posted")
   - **Remove do fluxo de caixa** as parcelas já pagas
   - **Mantém no fluxo de caixa** apenas as parcelas futuras

---

## ✅ Validações e Regras

### **Regras de Idempotência (Sem Duplicatas)**

O sistema **NUNCA duplica** transações porque:

1. **Gera um `external_id` único** para cada transação baseado em:
   - Data
   - Valor
   - Descrição
   - Entidade
   - Conta
   - Fonte (CSV ou Scraper)

2. **Verifica antes de inserir:**
   - Se já existe transação com mesmo `external_id` → **PULA**
   - Se encontra transação similar (fuzzy match) → **AVISA** e pula

3. **Atualiza ao invés de duplicar:**
   - Se você importar a mesma planilha 2x → só importa na primeira vez
   - Se importar planilha atualizada → **atualiza** os dados (não duplica)

### **Regras de Conciliação**

1. **Detecção automática de pagamentos de cartão:**
   - Sistema procura transações que correspondam ao valor e data de parcelas
   - Quando encontra → **baixa automaticamente**

2. **Conciliação com schedules/commitments:**
   - Se `autoReconcile` estiver ativo
   - Sistema tenta vincular transações importadas a compromissos agendados

---

## 🎯 Fluxo Ideal para Novos Usuários

### **Passo a Passo Recomendado:**

1. ✅ **Criar Entidades**
   - Criar todas as PF/PJ que você vai gerenciar
   - Exemplo: "João Silva (PF)", "Empresa XYZ Ltda (PJ)"

2. ✅ **Criar Contas (Opcional)**
   - Para cada entidade, criar contas principais
   - Exemplo: "Conta Corrente Itaú", "Conta Investimento BTG"

3. ✅ **Primeira Importação (Via CSV)**
   - Importar extratos históricos via CSV
   - Isso popula o sistema rapidamente

4. ✅ **Configurar Scrapers (Para Automação Futura)**
   - Configurar scrapers para sincronização automática
   - Isso mantém o sistema atualizado sem trabalho manual

5. ✅ **Acompanhar Fluxo de Caixa**
   - Visualizar `/app/cashflow` para ver projeções
   - Parcelas aparecem automaticamente com datas corretas

---

## 🔍 Respostas para Perguntas Comuns

### **"Preciso criar conta antes de importar?"**
**Não.** O sistema cria automaticamente se você não escolher uma. Mas é melhor criar antes para organização.

### **"Posso importar a mesma planilha 2x?"**
**Sim, sem problema.** O sistema detecta duplicatas e não importa de novo. Ou atualiza se os dados mudaram.

### **"Como o sistema sabe que uma parcela foi paga?"**
Quando você importa uma transação de pagamento da fatura, o sistema:
1. Compara valor e data
2. Encontra parcelas pendentes que correspondem
3. Marca como "posted" automaticamente

### **"Scrapers e CSV fazem a mesma coisa?"**
**Sim.** Ambos importam transações. A diferença:
- **CSV:** Manual, você faz quando quiser
- **Scrapers:** Automático, sincroniza periodicamente

### **"Posso ter múltiplas contas do mesmo banco?"**
**Sim.** Cada conta é única por entidade. Exemplo:
- Entidade "João Silva": Conta Corrente Itaú + Conta Investimento Itaú
- Entidade "Empresa XYZ": Conta Corrente Itaú PJ

### **"O que acontece se eu não escolher entidade?"**
**O sistema NÃO deixa você continuar.** Entidade é **OBRIGATÓRIA** para:
- Importar CSV
- Configurar Scraper
- Criar Conta
- Criar Cartão

---

## 🚨 Erros Comuns e Soluções

### **Erro: "Nenhuma entidade cadastrada"**
**Solução:** Vá em `/app/entities` e crie uma entidade primeiro.

### **Erro: "Select.Item value vazio"**
**Solução:** Corrigido! Se ainda aparecer, recarregue a página.

### **Problema: Transações duplicadas**
**Solução:** Verifique se está usando `skipDuplicates: true` na importação.

### **Problema: Parcelas não baixam automaticamente**
**Solução:** 
- Verifique se o valor e data do pagamento correspondem à parcela
- Sistema tem tolerância de 1 centavo e até 30 dias após vencimento

---

## 📊 Resumo Visual do Fluxo

```
┌─────────────────┐
│  CRIAR ENTIDADE │ ← OBRIGATÓRIO PRIMEIRO
│   (PF ou PJ)    │
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│ CRIAR CONTAS │ │ IMPORTAR │ │ CONFIGURAR  │
│  (Opcional)  │ │   CSV    │ │  SCRAPERS   │
└──────┬───────┘ └────┬─────┘ └──────┬──────┘
       │              │              │
       └──────────────┴──────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │   TRANSAÇÕES    │
            │    IMPORTADAS   │
            └────────┬────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌──────────────────┐  ┌─────────────────┐
│ BAIXA AUTOMÁTICA │  │  FLUXO DE CAIXA │
│  DE PARCELAS     │  │   ATUALIZADO    │
└──────────────────┘  └─────────────────┘
```

---

## 🎓 Próximos Passos

Após entender este fluxo:

1. ✅ Crie suas entidades
2. ✅ Importe dados históricos (CSV)
3. ✅ Configure scrapers para automação
4. ✅ Acompanhe o fluxo de caixa
5. ✅ Use outras funcionalidades (Compromissos, Contratos, etc.)

**Dúvidas?** Consulte a documentação específica de cada módulo.

