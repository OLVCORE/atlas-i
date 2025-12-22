# MC2 - Checklist de Validação

## Status: PRONTO PARA VALIDAÇÃO

---

## Pré-requisitos

- [x] MC1 completo e validado
- [x] Migration MC1 executada
- [x] Usuário criado e autenticado
- [x] Workspace criado

---

## 1. Migration SQL

### 1.1 Executar Migration MC2

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o arquivo: `supabase/migrations/20251220_000002_mc2_core.sql`
4. Verifique sucesso na execução

**Resultado esperado:** "Success" ou "Success. No rows returned"

### 1.2 Verificar Tabelas Criadas

No **Table Editor**, verifique que existem:
- [ ] `entities`
- [ ] `accounts`
- [ ] `transactions`

### 1.3 Verificar RLS Habilitado

No **Table Editor** ou **Authentication > Policies**, verifique:
- [ ] RLS habilitado em `entities`
- [ ] RLS habilitado em `accounts`
- [ ] RLS habilitado em `transactions`

### 1.4 Verificar Policies Criadas

Para cada tabela, devem existir 4 policies:
- [ ] `entities_select_for_members`
- [ ] `entities_insert_for_members`
- [ ] `entities_update_for_members`
- [ ] `entities_delete_for_members`
- [ ] `accounts_select_for_members`
- [ ] `accounts_insert_for_members`
- [ ] `accounts_update_for_members`
- [ ] `accounts_delete_for_members`
- [ ] `transactions_select_for_members`
- [ ] `transactions_insert_for_members`
- [ ] `transactions_update_for_members`
- [ ] `transactions_delete_for_members`

**Total:** 12 policies (4 por tabela)

---

## 2. Instalação de Dependências

```bash
npm install
```

**Resultado esperado:** Dependências instaladas sem erros

---

## 3. Build e Lint

```bash
npm run build
npm run lint
```

**Resultado esperado:** Build e lint passam sem erros

---

## 4. Testes Funcionais

### 4.1 Entidades (Entities)

**Criar Entity PF:**
1. Acesse `/app/entities`
2. Preencha:
   - Tipo: PF
   - Nome: "Marcos Oliveira"
   - Documento: "123.456.789-00"
3. Clique em "Criar Entidade"
4. **Resultado esperado:** Entity aparece na tabela

**Criar Entity PJ:**
1. Preencha:
   - Tipo: PJ
   - Nome: "Empresa XYZ Ltda"
   - Documento: "12.345.678/0001-90"
2. Clique em "Criar Entidade"
3. **Resultado esperado:** Entity aparece na tabela

**Validar:**
- [ ] Duas entities aparecem na tabela
- [ ] Dados corretos exibidos
- [ ] Sem erros no console

---

### 4.2 Contas (Accounts)

**Criar Conta:**
1. Acesse `/app/accounts`
2. Preencha:
   - Entidade: Selecione uma entity criada
   - Nome: "Conta Corrente Principal"
   - Tipo: "Conta Corrente"
   - Saldo Inicial: 1000.00
   - Data: Data atual
3. Clique em "Criar Conta"
4. **Resultado esperado:** Conta aparece na tabela

**Criar Outra Conta:**
1. Crie uma segunda conta com:
   - Entity diferente (ou mesma)
   - Nome: "Conta Investimento"
   - Tipo: "Investimento"
   - Saldo: 5000.00
2. **Resultado esperado:** Ambas as contas aparecem na tabela

**Validar:**
- [ ] Contas aparecem na tabela
- [ ] Entity correta vinculada
- [ ] Saldos formatados corretamente (R$)
- [ ] Sem erros no console

---

### 4.3 Ledger (Transactions)

**Criar Receita:**
1. Acesse `/app/ledger`
2. Preencha:
   - Entidade: Selecione uma entity
   - Conta: Selecione uma conta (opcional)
   - Tipo: "Receita"
   - Valor: 1500.00
   - Data: Data atual
   - Descrição: "Venda de produtos"
3. Clique em "Registrar Transação"
4. **Resultado esperado:** Transação aparece na tabela em VERDE

**Criar Despesa:**
1. Preencha:
   - Entidade: Mesma ou diferente
   - Conta: Selecione uma conta (opcional)
   - Tipo: "Despesa"
   - Valor: 250.00
   - Data: Data atual
   - Descrição: "Pagamento de fornecedor"
2. Clique em "Registrar Transação"
3. **Resultado esperado:** Transação aparece na tabela em VERMELHO (valor negativo)

**Criar Transferência:**
1. Preencha:
   - Entidade: Selecione uma entity
   - Conta: Selecione uma conta
   - Tipo: "Transferência"
   - Valor: 500.00
   - Data: Data atual
   - Descrição: "Transferência entre contas"
2. Clique em "Registrar Transação"
3. **Resultado esperado:** Transação aparece na tabela

**Validar:**
- [ ] Todas as transações aparecem na tabela
- [ ] Receitas em verde (valores positivos)
- [ ] Despesas em vermelho (valores negativos)
- [ ] Valores formatados corretamente (R$)
- [ ] Sem erros no console

---

## 5. Validação RLS (Isolamento Multi-Tenant)

### 5.1 Criar Segundo Usuário

1. Abra janela anônima do navegador
2. Acesse `/login`
3. Crie nova conta com e-mail diferente
4. Faça login

### 5.2 Validar Isolamento

**Como User 2:**
1. Acesse `/app/entities`
2. **Resultado esperado:** Lista vazia (nenhuma entity do User 1)
3. Crie uma entity
4. **Resultado esperado:** Entity criada aparece

**Voltar para User 1:**
1. Volte para a aba do User 1
2. Acesse `/app/entities`
3. **Resultado esperado:** Apenas entities do User 1 aparecem (não vê entities do User 2)

**Repetir para Accounts e Transactions:**
- [ ] Accounts isoladas por workspace
- [ ] Transactions isoladas por workspace
- [ ] Nenhum dado cruza workspaces

---

## 6. Validação de Erros

### 6.1 Estados Vazios

- [ ] Página entities mostra "Nenhuma entidade cadastrada" quando vazia
- [ ] Página accounts mostra "Nenhuma conta cadastrada" quando vazia
- [ ] Página ledger mostra "Nenhuma transação registrada" quando vazia

### 6.2 Formulários

- [ ] Campos obrigatórios validados
- [ ] Mensagens de erro claras (se houver)
- [ ] Tipos de dados corretos (números, datas, etc.)

---

## 7. Navegação

- [ ] Menu no header funciona (Entidades, Contas, Ledger)
- [ ] Links direcionam para páginas corretas
- [ ] Página inicial (/app) mostra cards de navegação
- [ ] Cards direcionam para páginas corretas

---

## 8. Checklist Final

### Funcionalidades Core
- [ ] Entities podem ser criadas (PF e PJ)
- [ ] Accounts podem ser criadas vinculadas a entities
- [ ] Transactions podem ser registradas (income, expense, transfer)
- [ ] Todos os dados são listados corretamente

### Segurança e RLS
- [ ] RLS habilitado em todas as tabelas
- [ ] Policies funcionando corretamente
- [ ] Isolamento total entre workspaces
- [ ] Nenhum erro de recursão ou permissão

### UI/UX
- [ ] Interface limpa e funcional
- [ ] Formulários intuitivos
- [ ] Estados vazios apropriados
- [ ] Navegação clara

### Código
- [ ] Build passa
- [ ] Lint passa
- [ ] Nenhum erro no console
- [ ] Código limpo e organizado

---

## Resultado Final

Após completar todos os testes:

✅ **MC2 APROVADO** - Sistema funcional e pronto para MC3

❌ **MC2 REPROVADO** - Corrigir problemas antes de avançar

---

## Problemas Conhecidos (Se Aplicável)

- [ ] Listar problemas encontrados aqui
- [ ] Ações corretivas tomadas

---

**Data de Validação:** _______________  
**Validado por:** _______________  
**Status:** _______________

