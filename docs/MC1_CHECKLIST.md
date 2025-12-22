# MC1 - Checklist de Validação

## Arquivos Criados

### Configuração do Projeto
- `package.json` - Dependências do projeto
- `tsconfig.json` - Configuração TypeScript
- `next.config.js` - Configuração Next.js
- `tailwind.config.ts` - Configuração Tailwind CSS
- `postcss.config.js` - Configuração PostCSS
- `.eslintrc.json` - Configuração ESLint
- `.gitignore` - Arquivos ignorados pelo Git
- `.env.example` - Exemplo de variáveis de ambiente
- `next-env.d.ts` - Tipos Next.js

### Documentação
- `README.md` - Instruções de setup
- `docs/ATLAS-i_PROMPT_FUNDACIONAL.md` - Documento fundacional do sistema
- `docs/MC1_CHECKLIST.md` - Este arquivo

### Aplicação
- `app/layout.tsx` - Layout raiz com ThemeProvider
- `app/page.tsx` - Página inicial (redireciona)
- `app/globals.css` - Estilos globais (Tailwind)
- `app/login/page.tsx` - Página de login
- `app/app/layout.tsx` - Layout da área autenticada
- `app/app/page.tsx` - Página principal do app (shell básico)

### Utilitários e Clientes
- `lib/utils.ts` - Funções utilitárias (cn)
- `lib/supabase/client.ts` - Cliente Supabase para browser
- `lib/supabase/server.ts` - Cliente Supabase para server
- `lib/workspace.ts` - Lógica de criação/busca de workspace
- `middleware.ts` - Middleware Next.js (proteção de rotas)

### Componentes UI
- `components/theme-provider.tsx` - Provider de tema (next-themes)
- `components/theme-toggle.tsx` - Botão de toggle de tema
- `components/ui/button.tsx` - Componente Button (shadcn/ui)
- `components/ui/input.tsx` - Componente Input (shadcn/ui)
- `components/ui/label.tsx` - Componente Label (shadcn/ui)

### Banco de Dados
- `supabase/migrations/20251220_000001_mc1_workspaces.sql` - Migration SQL completa

### Tipos
- `types/database.types.ts` - Tipos TypeScript para o banco

## Migration SQL

A migration completa está em: `supabase/migrations/20251220_000001_mc1_workspaces.sql`

Contém:
- Tabelas: `workspaces` e `workspace_members`
- RLS habilitado em ambas
- Policies para SELECT, INSERT, UPDATE, DELETE
- Função `create_default_workspace_for_new_user()`
- Trigger para criar workspace automático ao criar usuário
- Índices para performance

## Como Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Preencha:
   - Project Name: `atlas-i` (ou nome de sua escolha)
   - Database Password: (anote esta senha)
   - Region: escolha a mais próxima
5. Aguarde a criação do projeto (alguns minutos)
6. Após criar, acesse **Settings** > **API**
7. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
8. Cole no arquivo `.env.local` do projeto

## Executar Migration SQL

1. No Supabase Dashboard, vá em **SQL Editor**
2. Clique em **New Query**
3. Cole o conteúdo completo de `supabase/migrations/20251220_000001_mc1_workspaces.sql`
4. Clique em **Run** (ou F5)
5. Verifique que a execução foi bem-sucedida

## Comandos para Rodar Localmente

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build de produção
npm run build

# Executar build de produção
npm start

# Verificar lint
npm run lint
```

O app estará disponível em `http://localhost:3000`

## Testes Rápidos

### 1. Login e Criação de Workspace

1. Acesse `http://localhost:3000`
2. Será redirecionado para `/login`
3. Clique em "Criar conta"
4. Preencha email e senha
5. Após criar conta, será redirecionado para `/app`
6. Verifique que aparece "Workspace Ativo: Meu Workspace"

### 2. Validação RLS - Isolamento de Workspaces

#### Teste 1: Verificar isolamento via aplicação

1. Crie uma segunda conta de usuário (email diferente)
2. Faça login com a segunda conta
3. Verifique que aparece "Meu Workspace" (workspace diferente do primeiro usuário)
4. Cada usuário deve ver apenas seu próprio workspace

#### Teste 2: Verificar isolamento via SQL Editor (Supabase)

1. No Supabase Dashboard, vá em **SQL Editor**
2. Execute:

```sql
-- Como usuário 1 (substitua pelo UUID do primeiro usuário)
SET request.jwt.claim.sub = 'uuid-do-usuario-1-aqui';
SELECT * FROM workspaces;
SELECT * FROM workspace_members;
```

3. Deve retornar apenas os dados do usuário 1

4. Execute:

```sql
-- Como usuário 2 (substitua pelo UUID do segundo usuário)
SET request.jwt.claim.sub = 'uuid-do-usuario-2-aqui';
SELECT * FROM workspaces;
SELECT * FROM workspace_members;
```

5. Deve retornar apenas os dados do usuário 2

#### Teste 3: Tentar acessar workspace de outro usuário (deve falhar)

1. No SQL Editor, execute:

```sql
-- Como usuário 1, tentar acessar workspace do usuário 2 (substitua pelos UUIDs reais)
SET request.jwt.claim.sub = 'uuid-usuario-1';
SELECT * FROM workspaces WHERE id = 'uuid-workspace-usuario-2';
```

2. Deve retornar vazio (RLS bloqueou)

### 3. Verificar Trigger de Criação Automática

1. Crie um novo usuário via Supabase Auth (Authentication > Users > Add User)
2. O trigger deve criar automaticamente um workspace "Meu Workspace"
3. Verifique na tabela `workspaces` e `workspace_members`

### 4. Verificar Tema (Light/Dark/System)

1. No header da aplicação, clique no botão de tema
2. O tema deve alternar entre light e dark
3. Verifique que a preferência é persistida (recarregue a página)

### 5. Verificar Proteção de Rotas

1. Sem estar logado, tente acessar `http://localhost:3000/app`
2. Deve redirecionar para `/login`
3. Após fazer login, tente acessar `/login`
4. Deve redirecionar para `/app`

## Critérios de Aceite MC1

- ✅ Usuário faz login (Supabase Auth)
- ✅ Ao primeiro login, cria automaticamente 1 workspace "Meu Workspace" e adiciona o usuário como owner
- ✅ Qualquer consulta só retorna dados do workspace do usuário (RLS funcionando)
- ✅ Build e lint passam
- ✅ O app roda localmente com .env.local
- ✅ Tema system|light|dark funciona e persiste
- ✅ Rotas protegidas funcionam corretamente

## Status

MC1 concluído e pronto para validação.

Aguardar comando: **"INICIAR MC2"**

