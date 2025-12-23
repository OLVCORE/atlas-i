# 🚀 Jornada do Usuário - Scrapers Bancários

## 📋 Fluxo Completo (Passo a Passo)

### **CENÁRIO: Usuário quer conectar banco Itaú e importar transações automaticamente**

---

## 1️⃣ **PASSO 1: Criar Entidade (OBRIGATÓRIO)**

**Onde:** `/app/entities`

**Ações:**
1. Clicar em "Nova Entidade"
2. Selecionar tipo: **Pessoa Física** ou **Pessoa Jurídica**
3. Preencher:
   - Nome completo / Razão Social
   - CPF / CNPJ
   - (Opcional) Outros dados
4. Clicar em "Salvar"

**Resultado Esperado:**
- Entidade criada e aparecendo na lista
- Exemplo: "João Silva (PF)" ou "Empresa XYZ Ltda (PJ)"

**Status Atual:** ✅ **FUNCIONANDO**

---

## 2️⃣ **PASSO 2: Configurar Scraper do Banco**

**Onde:** `/app/scrapers`

### **2.1. Acessar Página de Scrapers**

**Ações:**
1. No menu lateral, clicar em **"Scrapers Bancários"**
2. Ver a página de scrapers (inicialmente vazia)

**Resultado Esperado:**
- Página carregada
- Mensagem: "Nenhuma conexão configurada"
- Botão: "+ Nova Conexão"

**Status Atual:** ✅ **FUNCIONANDO**

---

### **2.2. Criar Nova Conexão**

**Ações:**
1. Clicar em **"+ Nova Conexão"**
2. Ver formulário de conexão

**Campos do Formulário:**

#### **Campo 1: Entidade * (OBRIGATÓRIO)**
- **Dropdown** com lista de entidades criadas
- **Selecionar:** A entidade que possui esta conta bancária
- Exemplo: "João Silva (Pessoa Física)"

**Status:** ✅ **FUNCIONANDO**

#### **Campo 2: Banco * (OBRIGATÓRIO)**
- **Dropdown** com bancos disponíveis:
  - Itaú
  - Santander
  - BTG Pactual
  - Mercado Pago
- **Selecionar:** Banco desejado
- Exemplo: "Itaú"

**Status:** ✅ **FUNCIONANDO** (interface), ❌ **Scraper real não implementado**

#### **Campo 3: Usuário/CPF/CNPJ * (OBRIGATÓRIO)**
- **Input text**
- **Digitar:** CPF (se PF) ou CNPJ (se PJ), ou usuário do banco
- Exemplo: "12345678900"

**Status:** ✅ **FUNCIONANDO**

#### **Campo 4: Senha * (OBRIGATÓRIO)**
- **Input password**
- **Digitar:** Senha do internet banking
- **Segurança:** Senha nunca exposta no HTML

**Ações Adicionais:**
- Botão **"🔒 Testar Conexão"** aparece após digitar senha
- **Recomendado:** Clicar em "Testar Conexão" antes de salvar

**Status:** ✅ **FUNCIONANDO** (interface e segurança), ⚠️ **Teste real não implementado**

#### **Campo 5: Secret 2FA (Opcional)**
- **Input text**
- **Digitar:** Secret para autenticação de dois fatores (se o banco usar)
- Exemplo: "JBSWY3DPEHPK3PXP"

**Status:** ✅ **FUNCIONANDO** (interface)

#### **Campo 6: Conta (Opcional)**
- **Dropdown** com contas existentes da entidade selecionada
- **Selecionar:** Conta existente OU deixar vazio para criar automaticamente
- Exemplo: "Conta Corrente Itaú" ou "Nenhuma (criar automaticamente)"

**Status:** ✅ **FUNCIONANDO**

#### **Campo 7: Frequência de Sincronização**
- **Dropdown:** Diário / Semanal / Mensal
- **Selecionar:** Com que frequência o sistema deve sincronizar
- Exemplo: "Diário"

**Status:** ✅ **FUNCIONANDO**

#### **Campo 8: Horário**
- **Input time**
- **Selecionar:** Horário para sincronização automática
- Exemplo: "06:00"

**Status:** ✅ **FUNCIONANDO**

---

### **2.3. Testar Conexão (RECOMENDADO)**

**Ações:**
1. Preencher todos os campos obrigatórios
2. Clicar em **"🔒 Testar Conexão"**
3. Aguardar resultado

**Resultado Esperado:**
- ✅ **Sucesso:** Mensagem verde "✅ Conexão testada com sucesso!"
- ❌ **Erro:** Mensagem vermelha com detalhes do erro

**Status Atual:** ⚠️ **Implementado parcialmente** (validação básica, mas teste real não funciona)

---

### **2.4. Salvar Conexão**

**Ações:**
1. (Opcional) Testar conexão primeiro
2. Clicar em **"💾 Salvar Conexão"**
3. Sistema salva e criptografa credenciais

**Resultado Esperado:**
- ✅ Mensagem: "Conexão salva com sucesso!"
- Conexão aparece na lista de conexões

**Status Atual:** ✅ **FUNCIONANDO** (salva no banco, mas scraper não funciona ainda)

---

## 3️⃣ **PASSO 3: Sincronizar Dados**

**Onde:** `/app/scrapers` (mesma página)

### **3.1. Listar Conexões**

**Resultado Esperado:**
- Lista de conexões criadas
- Cada conexão mostra:
  - Nome do banco
  - Entidade vinculada
  - Última sincronização
  - Status (ativo/inativo)

**Status Atual:** ✅ **FUNCIONANDO**

---

### **3.2. Sincronizar Manualmente**

**Ações:**
1. Na lista de conexões, encontrar a conexão desejada
2. Clicar em **"🔄 Sincronizar"**
3. Aguardar sincronização

**O Que Deve Acontecer (QUANDO IMPLEMENTADO):**

```
1. Sistema descriptografa credenciais (servidor)
2. Sistema faz login no banco (usando Puppeteer/Browserless)
3. Sistema navega até extrato/transações
4. Sistema extrai transações:
   - Data
   - Descrição
   - Valor
   - Tipo (receita/despesa)
5. Sistema importa transações (mesma lógica do CSV)
6. Sistema faz baixa automática de parcelas de cartão
7. Sistema atualiza fluxo de caixa
8. Sistema atualiza status da conexão (última sincronização)
```

**Resultado Esperado:**
- ✅ Mensagem: "Sincronização concluída! X transações importadas."
- Transações aparecem no Ledger (`/app/ledger`)
- Parcelas de cartão são baixadas automaticamente
- Fluxo de caixa é atualizado

**Status Atual:** ❌ **NÃO FUNCIONA** (scraper real não implementado)

---

## 4️⃣ **PASSO 4: Verificar Dados Importados**

### **4.1. Ver Transações**

**Onde:** `/app/ledger`

**Ações:**
1. Acessar "Ledger" no menu
2. Ver transações importadas

**Resultado Esperado:**
- Lista de transações do banco
- Vinculadas à entidade correta
- Vinculadas à conta correta (ou criada automaticamente)

**Status Atual:** ⚠️ **Depende do scraper funcionar**

---

### **4.2. Ver Fluxo de Caixa**

**Onde:** `/app/cashflow`

**Ações:**
1. Acessar "Fluxo de Caixa" no menu
2. Ver projeções atualizadas

**Resultado Esperado:**
- Parcelas de cartão aparecem com datas corretas
- Transações importadas aparecem
- Fluxo de caixa reflete dados reais do banco

**Status Atual:** ⚠️ **Depende do scraper funcionar**

---

## 🎯 **FLUXO VISUAL COMPLETO**

```
┌─────────────────────────────────────────────────────────────┐
│                    JORNADA DO USUÁRIO                        │
└─────────────────────────────────────────────────────────────┘

1. CRIAR ENTIDADE
   /app/entities
   ↓
   [Criar "João Silva (PF)"]
   ✅ FUNCIONANDO

2. CONFIGURAR SCRAPER
   /app/scrapers
   ↓
   [Clicar "+ Nova Conexão"]
   ↓
   [Selecionar: Entidade = "João Silva"]
   [Selecionar: Banco = "Itaú"]
   [Digitar: CPF = "12345678900"]
   [Digitar: Senha = "******"]
   [Clicar: "Testar Conexão"] ← ⚠️ NÃO FUNCIONA AINDA
   [Clicar: "Salvar Conexão"]
   ✅ Salva no banco (criptografado)
   ❌ Scraper real não implementado

3. SINCRONIZAR
   /app/scrapers
   ↓
   [Clicar "Sincronizar" na conexão]
   ↓
   ❌ NÃO FUNCIONA (scraper não implementado)
   ↓
   O QUE DEVERIA ACONTECER:
   - Login no banco
   - Extrair transações
   - Importar no sistema
   - Atualizar fluxo de caixa

4. VERIFICAR DADOS
   /app/ledger → Ver transações
   /app/cashflow → Ver projeções
   ⚠️ Depende do passo 3 funcionar
```

---

## 🔴 **PROBLEMAS IDENTIFICADOS**

### **Problema 1: Scraper Real Não Implementado**
- **Status:** Interface funciona, mas scraper não faz login real
- **Impacto:** Usuário não consegue testar
- **Solução:** Implementar login real usando Puppeteer/Browserless

### **Problema 2: Teste de Conexão Não Funciona**
- **Status:** Endpoint existe, mas não testa login real
- **Impacto:** Usuário não sabe se credenciais estão corretas antes de salvar
- **Solução:** Implementar teste real de login

### **Problema 3: Falta Feedback Visual**
- **Status:** Usuário não sabe claramente o que aconteceu
- **Impacto:** Confusão sobre se funcionou ou não
- **Solução:** Melhorar mensagens e status

### **Problema 4: Falta Campos Importantes**
- **Status:** Não há campos para agência, conta específica, etc.
- **Impacto:** Pode não ser suficiente para alguns bancos
- **Solução:** Adicionar campos conforme necessário

---

## ✅ **O QUE ESTÁ FUNCIONANDO**

1. ✅ Interface completa
2. ✅ Validação de campos
3. ✅ Criptografia de credenciais
4. ✅ Armazenamento seguro
5. ✅ Listagem de conexões
6. ✅ Integração com sistema de importação (quando dados chegarem)

---

## 🚧 **O QUE PRECISA SER IMPLEMENTADO**

1. ❌ **Login real no banco** (Puppeteer/Browserless)
2. ❌ **Extração de transações** (parsing do HTML/API)
3. ❌ **Tratamento de 2FA** (quando necessário)
4. ❌ **Teste de conexão real** (validar credenciais)
5. ⚠️ **Campos adicionais** (agência, conta, etc. - se necessário)

---

## 🎯 **PRÓXIMOS PASSOS RECOMENDADOS**

1. **Implementar scraper Itaú real** (como prova de conceito)
2. **Testar com conta real** (sandbox/teste)
3. **Iterar e melhorar** baseado no feedback
4. **Expandir para outros bancos**

---

## 📝 **NOTAS IMPORTANTES**

- **Segurança:** Credenciais são criptografadas antes de salvar ✅
- **Privacidade:** Senha nunca exposta no HTML ✅
- **Funcionalidade:** Scraper real ainda não implementado ❌
- **Teste:** Impossível testar completamente sem scraper real ❌

