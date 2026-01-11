# Fluxo de Importação e Gestão de Contas

## Resumo Executivo

O sistema oferece **duas formas** de trabalhar com contas:

1. **Criar conta manualmente** primeiro (recomendado para começar)
2. **Importar arquivo e criar conta automaticamente** (mais rápido para operações regulares)

Ambas as opções funcionam perfeitamente e são complementares.

---

## 📋 Fluxo 1: Criar Conta Manualmente (Recomendado para Início)

### Quando usar:
- ✅ Primeira vez usando o sistema
- ✅ Quando você quer controlar exatamente os nomes e detalhes das contas
- ✅ Quando você quer configurar saldo inicial antes de importar transações

### Passos:

1. **Criar Entidade (PF ou PJ)** (se ainda não tiver)
   - Acesse: `/app/entities`
   - Clique em "Criar Entidade"
   - Preencha: Tipo (PF/PJ), Nome, Documento
   - Clique em "Criar"

2. **Criar Conta**
   - Acesse: `/app/accounts`
   - Selecione a Entidade no filtro (ou deixe "Consolidado")
   - Preencha o formulário:
     - **Entidade**: Selecione PF ou PJ
     - **Nome**: Ex: "Conta Corrente Itaú"
     - **Tipo**: Conta Corrente, Investimento, ou Outro
     - **Saldo Inicial**: Saldo atual da conta
     - **Data do Saldo**: Data em que esse saldo foi registrado
   - Clique em "Criar Conta"

3. **Importar Transações**
   - Acesse: `/app/import`
   - Selecione a Entidade
   - Selecione a Conta (criada no passo 2)
   - Faça upload do arquivo CSV/XLS/XLSX/TXT
   - Clique em "Importar"

**Resultado:** As transações serão importadas e vinculadas à conta selecionada.

---

## 📋 Fluxo 2: Importar e Criar Conta Automaticamente (Recomendado para Operações Regulares)

### Quando usar:
- ✅ Quando você já tem uma entidade criada
- ✅ Quando você quer agilizar o processo
- ✅ Quando o nome da conta pode ser detectado automaticamente do arquivo

### Passos:

1. **Criar Entidade (PF ou PJ)** (se ainda não tiver)
   - Acesse: `/app/entities`
   - Clique em "Criar Entidade"
   - Preencha os dados
   - Clique em "Criar"

2. **Importar Arquivo**
   - Acesse: `/app/import`
   - **Selecione a Entidade** (obrigatório)
   - **Deixe "Conta" como "Nenhuma (criar automaticamente)"**
   - **Preencha o nome da nova conta** (se necessário):
     - Ex: "Conta Corrente BB"
     - Ex: "Cartão de Crédito Nubank"
   - **Selecione o tipo da conta**: Conta Corrente, Investimento, ou Outro
   - Faça upload do arquivo CSV/XLS/XLSX/TXT
   - Clique em "Importar"

**Resultado:** 
- Uma nova conta será criada automaticamente
- As transações serão importadas e vinculadas à nova conta
- Na próxima vez, a conta já estará disponível para seleção

---

## 🔄 Fluxo 3: Importar para Conta Existente

### Quando usar:
- ✅ Quando você já tem a conta criada
- ✅ Quando você está importando um novo extrato de uma conta existente
- ✅ Quando você quer manter histórico organizado

### Passos:

1. **Acesse: `/app/import`**
2. **Selecione a Entidade**
3. **Selecione a Conta existente** (não deixe "Nenhuma")
4. Faça upload do arquivo CSV/XLS/XLSX/TXT
5. Clique em "Importar"

**Resultado:** As transações serão importadas e vinculadas à conta selecionada.

---

## ⚠️ Regras Importantes

### 1. Entidade é Obrigatória
- Você **SEMPRE** precisa ter pelo menos uma entidade (PF ou PJ) criada antes de importar
- Se não tiver, o sistema mostrará um aviso e um botão para criar

### 2. Duplicatas
- O sistema pode detectar transações duplicadas automaticamente
- Marque "Pular transações duplicadas" para evitar duplicações
- A detecção é baseada em: data, valor e descrição similar

### 3. Formatos Suportados
- CSV (valores separados por vírgula)
- XLS (Excel antigo)
- XLSX (Excel moderno)
- TXT (texto, valores separados por tab ou espaço)

### 4. Tamanho Máximo
- 10 MB por arquivo

---

## 🎯 Recomendação de Uso

### Para Começar (Primeira Vez):
1. Crie todas as suas entidades (PF e PJ)
2. Crie todas as suas contas principais manualmente
3. Configure os saldos iniciais de cada conta
4. Depois, use o Fluxo 3 para importar extratos regulares

### Para Operações Regulares:
1. Use o Fluxo 2 (criar conta automaticamente) para novas contas
2. Use o Fluxo 3 (conta existente) para extratos de contas já cadastradas

---

## ❓ Perguntas Frequentes

**P: Preciso criar conta antes de importar?**
R: Não necessariamente. Você pode deixar o sistema criar automaticamente (Fluxo 2), ou criar manualmente primeiro (Fluxo 1).

**P: O que acontece se eu importar o mesmo arquivo duas vezes?**
R: Se você marcar "Pular transações duplicadas", o sistema detectará e pulará as duplicatas. Caso contrário, serão criadas transações duplicadas.

**P: Posso mudar o nome da conta depois?**
R: Sim! Acesse `/app/accounts` e você poderá editar as informações da conta.

**P: E se eu tiver contas de bancos diferentes?**
R: Crie uma conta para cada banco/instituição. Ex: "Conta Corrente Itaú", "Conta Corrente BB", "Cartão Nubank", etc.

**P: Como funciona o saldo inicial?**
R: O saldo inicial é o saldo da conta em uma data específica. O sistema calcula o saldo atual somando todas as transações importadas ao saldo inicial.

---

## 📝 Exemplo Prático

### Cenário: João quer importar extratos do Itaú

**Opção A - Criar Conta Manualmente:**
1. João cria entidade "João Silva (PF)"
2. João cria conta "Conta Corrente Itaú" com saldo inicial R$ 1.000,00
3. João importa extrato CSV, selecionando a conta criada
4. Resultado: Transações importadas, saldo atualizado

**Opção B - Criar Conta Automaticamente:**
1. João cria entidade "João Silva (PF)"
2. João importa extrato CSV, deixando "Nenhuma conta" selecionada
3. João preenche nome: "Conta Corrente Itaú"
4. Resultado: Conta criada automaticamente + transações importadas

**Ambas as opções funcionam!** A escolha é sua. 🎉
