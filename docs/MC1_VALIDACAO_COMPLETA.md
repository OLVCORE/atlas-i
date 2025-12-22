# MC1 - Validação Completa - Guia Passo a Passo

## Status: PRONTO PARA VALIDAÇÃO

Este documento fornece instruções exatas para validar o MC1 completamente.

---

## ETAPA 1: Configuração do Ambiente Local

### 1.1 Verificar .env.local

O arquivo `.env.local` já foi criado na raiz do projeto com as credenciais do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vydsayvhovuqfdelxtko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_REJMwtwd8DddDHN15Ppgfw_w9fKY3Su
```

**Ação:** Verificar que o arquivo existe e contém essas variáveis.

### 1.2 Verificar .gitignore

O arquivo `.gitignore` já contém `.env*.local` na linha 28, garantindo que o `.env.local` não seja versionado.

**Ação:** Confirmar que `.env.local` está no `.gitignore`.

### 1.3 Instalar Dependências

```bash
npm install
```

**Resultado esperado:** Todas as dependências instaladas sem erros.

---

## ETAPA 2: Configuração do Supabase Dashboard

### 2.1 Configurar Authentication - Email Provider

1. Acesse: https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko
2. No menu lateral, clique em **Authentication**
3. Clique em **Providers**
4. Localize **Email** na lista
5. **HABILITE** o provider Email (toggle deve ficar verde)
6. Certifique-se de que **"Confirm email"** está **DESABILITADO** (para testes rápidos) ou habilitado conforme sua preferência
7. Clique em **Save**

**Validação:** Email provider deve aparecer como "Enabled"

### 2.2 Configurar URL Configuration

1. Ainda em **Authentication**, clique em **URL Configuration**
2. Configure:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** Adicione (uma por linha):
     ```
     http://localhost:3000
     http://localhost:3000/login
     http://localhost:3000/app
     ```
3. Clique em **Save**

**Validação:** URLs devem estar salvas

### 2.3 Executar Migration SQL

1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**
3. Abra o arquivo: `supabase/migrations/20251220_000001_mc1_workspaces.sql`
4. Copie **TODO** o conteúdo do arquivo
5. Cole no editor SQL do Supabase
6. Clique em **Run** (ou pressione Ctrl+Enter / Cmd+Enter)

**Resultado esperado:** 
- Mensagem "Success. No rows returned"
- Ou mensagem de sucesso sem erros

### 2.4 Verificar Tabelas Criadas

1. No menu lateral, clique em **Table Editor**
2. Verifique que existem as tabelas:
   - `workspaces`
   - `workspace_members`

**Validação:** Ambas as tabelas devem estar visíveis

### 2.5 Verificar RLS Habilitado

1. No **Table Editor**, clique na tabela `workspaces`
2. Na aba **Policies** (ou no menu lateral em **Authentication** > **Policies**)
3. Verifique que há policies criadas:
   - `workspaces_select_for_members`
   - `workspaces_insert_for_authenticated`
   - `workspaces_update_for_owner_admin`
   - `workspaces_delete_for_owner`

4. Repita para a tabela `workspace_members` (deve ter 4 policies também)

**Validação:** RLS deve estar habilitado e policies devem existir

---

## ETAPA 3: Execução Local

### 3.1 Rodar o Servidor de Desenvolvimento

```bash
npm run dev
```

**Resultado esperado:**
- Servidor iniciando na porta 3000
- Mensagem: "Ready in Xms" ou similar
- Nenhum erro crítico

### 3.2 Acessar a Aplicação

1. Abra o navegador
2. Acesse: `http://localhost:3000`
3. Deve redirecionar para `/login`

**Validação:** Página de login deve aparecer sem erros

---

## ETAPA 4: Testes de Aceite

### TESTE A: Criação de Conta e Login (User A)

**Objetivo:** Validar criação de workspace automática

1. Na página `/login`, preencha:
   - **E-mail:** `teste1@atlas-i.local` (ou qualquer e-mail válido)
   - **Senha:** `senha123456` (mínimo 6 caracteres)

2. Clique em **"Criar conta"**

**Resultado esperado:**
- Redirecionamento para `/app`
- Página mostra: "Workspace Ativo" e "Meu Workspace"
- Nenhum erro na tela

3. **Validar no Supabase:**
   - Table Editor > `workspaces`: Deve existir 1 workspace com name="Meu Workspace"
   - Table Editor > `workspace_members`: Deve existir 1 registro com role="owner" e user_id correspondente ao usuário criado

**Status esperado:** ✅ PASSOU

---

### TESTE B: Isolamento RLS (User B)

**Objetivo:** Provar que User B não enxerga workspace de User A

1. **Abrir janela anônima do navegador** (ou usar outro navegador)
2. Acesse: `http://localhost:3000/login`
3. Criar nova conta:
   - **E-mail:** `teste2@atlas-i.local` (DIFERENTE do User A)
   - **Senha:** `senha123456`

4. Clique em **"Criar conta"**

**Resultado esperado:**
- Redirecionamento para `/app`
- Página mostra: "Workspace Ativo" e "Meu Workspace"
- **IMPORTANTE:** Este é um workspace DIFERENTE do User A

5. **Validar no Supabase (SQL Editor):**

```sql
-- Ver todos os workspaces (como admin do Supabase)
SELECT id, name, created_by FROM workspaces;
```

Deve retornar 2 workspaces (um para cada usuário).

```sql
-- Ver todos os membros (como admin)
SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, w.name 
FROM workspace_members wm 
JOIN workspaces w ON w.id = wm.workspace_id;
```

Deve retornar 2 membros (cada um owner do seu próprio workspace).

**Validar RLS funcionando:**

6. **Como User A** (via aplicação):
   - Faça login novamente como `teste1@atlas-i.local`
   - Na aplicação, você deve ver apenas 1 workspace
   - **Você NÃO deve ver o workspace do User B**

7. **Como User B** (via aplicação):
   - Faça login como `teste2@atlas-i.local`
   - Na aplicação, você deve ver apenas 1 workspace
   - **Você NÃO deve ver o workspace do User A**

**Status esperado:** ✅ PASSOU

---

### TESTE C: Proteção de Rotas (Sem Loops)

**Objetivo:** Validar que não há loops de redirecionamento

1. **Sem estar logado:**
   - Acesse: `http://localhost:3000/app`
   - **Resultado esperado:** Redireciona para `/login` (UMA vez, sem loop)

2. **Estando logado:**
   - Faça login
   - Tente acessar: `http://localhost:3000/login`
   - **Resultado esperado:** Redireciona para `/app` (UMA vez, sem loop)

3. **Acessar rota raiz:**
   - Sem login: `http://localhost:3000/` → redireciona para `/login`
   - Com login: `http://localhost:3000/` → redireciona para `/app`

**Status esperado:** ✅ PASSOU (sem loops, sem erros 401/403)

---

### TESTE D: Trigger Automático de Workspace

**Objetivo:** Validar que o trigger cria workspace automaticamente

1. No Supabase Dashboard, vá em **Authentication** > **Users**
2. Clique em **Add User** (ou **Add user manually**)
3. Preencha:
   - **Email:** `teste3@atlas-i.local`
   - **Password:** `senha123456`
   - **Auto Confirm User:** ✅ (habilitado)
4. Clique em **Create User**

**Resultado esperado:**

5. Verifique em **Table Editor**:
   - `workspaces`: Deve ter um novo workspace "Meu Workspace" criado automaticamente
   - `workspace_members`: Deve ter um novo membro com role="owner" para esse workspace

**Status esperado:** ✅ PASSOU (workspace criado automaticamente pelo trigger)

---

### TESTE E: Build e Lint

**Objetivo:** Validar que o código compila sem erros

1. **Parar o servidor de desenvolvimento** (Ctrl+C)

2. **Build de produção:**
```bash
npm run build
```

**Resultado esperado:**
- Build completa sem erros
- Mensagem "Route (app)" e "Route (pages)" compiladas
- Nenhum erro de TypeScript

3. **Lint:**
```bash
npm run lint
```

**Resultado esperado:**
- Sem erros de lint
- Sem warnings críticos

**Status esperado:** ✅ PASSOU

---

## ETAPA 5: Diagnóstico de Problemas Comuns

### Problema 1: "Invalid API key" ou Erro 401/403

**Causa:** Variáveis de ambiente não carregadas

**Solução:**
1. Verificar que `.env.local` existe na raiz
2. Verificar que as variáveis estão corretas (sem espaços extras)
3. **Reiniciar o servidor** (`npm run dev`)
4. Limpar cache do navegador

---

### Problema 2: Workspace não é criado automaticamente

**Causa 1:** Trigger não executou

**Solução:**
1. Verificar no SQL Editor se o trigger existe:
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_create_workspace';
```

2. Se não existir, executar novamente a parte do trigger da migration

**Causa 2:** Falha na policy de INSERT

**Solução:**
- O código já tem fallback em `lib/workspace.ts` que cria workspace se não existir
- Verificar logs do navegador (F12 > Console) para ver erros específicos

---

### Problema 3: Policies impedem SELECT

**Causa:** RLS muito restritivo ou user_id não corresponde

**Validação:**
1. No SQL Editor, verificar qual é o user_id:
```sql
SELECT id, email FROM auth.users;
```

2. Verificar se há membro no workspace:
```sql
SELECT * FROM workspace_members WHERE user_id = 'uuid-do-usuario-aqui';
```

3. Se não houver, o fallback em `getOrCreateWorkspace()` deve criar

---

### Problema 4: Loop de Redirecionamento

**Causa:** Middleware ou verificação de sessão inconsistente

**Solução:**
1. Verificar logs do servidor (terminal onde roda `npm run dev`)
2. Verificar cookies do navegador (F12 > Application > Cookies)
3. Limpar cookies de `localhost:3000`
4. Tentar novamente

---

### Problema 5: Erro ao fazer Sign Up

**Causa:** Email confirmation habilitado

**Solução:**
1. No Supabase Dashboard > Authentication > Providers > Email
2. Desabilitar "Confirm email" temporariamente para testes
3. Ou verificar e-mail de confirmação na caixa de entrada

---

## ETAPA 6: Checklist Final

Marque cada item após validar:

- [ ] `.env.local` configurado corretamente
- [ ] Supabase Auth configurado (Email provider habilitado)
- [ ] URLs configuradas no Supabase
- [ ] Migration SQL executada com sucesso
- [ ] Tabelas `workspaces` e `workspace_members` existem
- [ ] RLS habilitado em ambas as tabelas
- [ ] Policies criadas (8 no total: 4 para cada tabela)
- [ ] Servidor roda localmente (`npm run dev`)
- [ ] Login funciona
- [ ] Criação de conta funciona
- [ ] Workspace criado automaticamente (TESTE A)
- [ ] Isolamento RLS funcionando (TESTE B)
- [ ] Proteção de rotas sem loops (TESTE C)
- [ ] Trigger automático funciona (TESTE D)
- [ ] Build passa (`npm run build`)
- [ ] Lint passa (`npm run lint`)

---

## RESULTADO FINAL

Após completar todos os testes acima, você deve ter:

✅ **STATUS MC1: APROVADO**

Se todos os testes passarem, o MC1 está validado e pronto para avançar.

Se algum teste falhar, seguir a seção "Diagnóstico de Problemas" e corrigir antes de avançar.

---

**Próximo passo:** Aguardar comando: **"INICIAR MC2"**

