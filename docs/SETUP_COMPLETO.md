# ATLAS-i - Setup Completo para Desenvolvimento

## 1. Desabilitar Confirmação de Email (OBRIGATÓRIO)

**Acesse:** https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko/auth/providers

1. Clique em **Email**
2. **DESLIGUE** "Confirm email" (toggle deve ficar cinza)
3. Clique em **Save**

**Resultado:** Novos usuários podem fazer login imediatamente sem confirmar email.

## 2. Configurar URLs (OBRIGATÓRIO)

**Acesse:** https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko/auth/url-configuration

1. **Site URL:** `http://localhost:3000`
2. **Redirect URLs:**
   ```
   http://localhost:3000
   http://localhost:3000/login
   http://localhost:3000/app
   ```
3. Clique em **Save**

## 3. Executar Migrations SQL

**Acesse:** https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko/sql/new

### MC1 - Workspaces
1. Abra: `supabase/migrations/20251220_000001_mc1_workspaces.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor
4. Clique em **Run**

### MC2 - Core Financeiro
1. Abra: `supabase/migrations/20251220_000002_mc2_core.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor
4. Clique em **Run**

## 4. Variáveis de Ambiente

Certifique-se que `.env.local` existe na raiz com:
```env
NEXT_PUBLIC_SUPABASE_URL=https://vydsayvhovuqfdelxtko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_REJMwtwd8DddDHN15Ppgfw_w9fKY3Su
```

## 5. Instalar e Rodar

```bash
npm install
npm run dev
```

## Resultado Esperado

- Login funciona (Magic Link ou senha)
- Usuário novo cria workspace automaticamente
- Todas as páginas funcionam (/app/entities, /app/accounts, /app/ledger)
- RLS isolando dados por workspace

## Se Magic Link não chegar

**Opção 1 - Logs do Supabase:**
1. Supabase Dashboard → Logs → Auth Logs
2. Procure o link completo no log
3. Copie e cole no navegador

**Opção 2 - Configurar SMTP:**
1. Supabase Dashboard → Authentication → Settings → SMTP Settings
2. Configure Gmail ou outro serviço
3. Veja `docs/MAGIC_LINK_SETUP.md` para detalhes

