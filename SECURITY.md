# SECURITY.md - MC9.0.2: HARDENING ENTERPRISE

## Modelo de Permissões

### Clientes Supabase

#### 1. Cliente UI (Session-based)
- **Arquivo:** `lib/supabase/client.ts` e `lib/supabase/server.ts`
- **Chave:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Uso:** Operações no cliente e servidor que respeitam RLS
- **Acesso:** Limitado por Row Level Security (RLS) baseado em `workspace_members`
- **Contexto:** Componentes React, Server Actions, páginas protegidas

#### 2. Cliente Admin (Service Role)
- **Arquivo:** `lib/supabase/admin.ts`
- **Chave:** `SUPABASE_SERVICE_ROLE_KEY` (NÃO pública)
- **Uso:** Operações administrativas que bypassam RLS
- **Acesso:** Completo ao banco (bypass RLS)
- **Contexto:** Apenas em:
  - API Routes protegidas por token (`/api/alerts/evaluate`)
  - Background jobs/cron
  - Server Actions administrativas

**REGRA CRÍTICA:** `SUPABASE_SERVICE_ROLE_KEY` NUNCA deve:
- Ser exposta em `NEXT_PUBLIC_*`
- Ser importada em componentes client (`"use client"`)
- Ser commitada no repositório
- Aparecer em logs ou erros

---

## Variáveis de Ambiente

### Obrigatórias (Build e Runtime)

```env
# Públicas (expostas no cliente)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Privadas (apenas servidor)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
INTERNAL_CRON_TOKEN=seu-token-seguro-aqui
```

### Validação no Middleware

O middleware (`middleware.ts`) implementa **fail-closed**:
- Se `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem ausentes → redireciona para `/login?err=misconfig`
- Se `supabase.auth.getUser()` falhar → redireciona para `/login?err=auth`
- Se usuário não autenticado → redireciona para `/login`

### Proteção de Assets

Assets públicos são excluídos do middleware:
- `/_next/*` (arquivos estáticos Next.js)
- `/favicon.ico`
- `/robots.txt`
- `/sitemap.xml`
- `/assets/*`, `/images/*`, `/public/*`
- Arquivos de imagem (`.svg`, `.png`, `.jpg`, etc.)

---

## API de Automação

### Endpoint: `/api/alerts/evaluate`

**Método:** `POST`

**Autenticação:**
```http
Authorization: Bearer <INTERNAL_CRON_TOKEN>
```

**Corpo:**
```json
{
  "workspace_ids": ["uuid-1", "uuid-2"] // Opcional: se omitido, processa todos
}
```

**Comportamento:**
- Valida token (`INTERNAL_CRON_TOKEN`)
- Retorna 401 se token inválido/ausente
- Usa `createSupabaseAdminClient()` para bypass RLS
- Grava alertas com `created_by = NULL` (automação)
- Registra audit logs com `actor_user_id = NULL`

**Uso:**
```bash
curl -X POST https://seu-dominio.com/api/alerts/evaluate \
  -H "Authorization: Bearer seu-token-aqui" \
  -H "Content-Type: application/json" \
  -d '{"workspace_ids": []}'
```

---

## Row Level Security (RLS)

### Regras de Acesso

#### UI (Session-based)
- **SELECT:** Apenas dados do workspace do usuário (via `workspace_members`)
- **INSERT/UPDATE/DELETE:** Apenas com permissão de membro (`role` in `owner`, `admin`, `member`)
- **Automação:** Bypass RLS via Service Role

#### Tabelas Críticas
- `workspaces`: Isolamento total por membro
- `workspace_members`: Apenas membros do workspace veem seus membros
- `alerts`: Filtrados por `workspace_id` via RLS
- `audit_logs`: Filtrados por `workspace_id` via RLS

### Validação de RLS

**Teste Manual:**
1. Criar dois usuários (A e B)
2. Cada um cria um workspace
3. Validar que A não vê dados de B (e vice-versa)
4. Validar que automação pode gravar em qualquer workspace

---

## Motor de Alertas

### Modo UI (On-demand)
- **Cliente:** Session-based (`lib/supabase/server.ts`)
- **Trigger:** Ação do usuário (ex: página `/app/alerts`)
- **Actor:** Usuário autenticado (`auth.uid()`)
- **Audit:** `actor_user_id = auth.uid()`

### Modo Automação
- **Cliente:** Admin (`lib/supabase/admin.ts`)
- **Trigger:** Cron job ou webhook externo
- **Actor:** Sistema (`created_by = NULL`)
- **Audit:** `actor_user_id = NULL`

---

## Checklist de Segurança

### Deploy
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada apenas no servidor (Vercel/ambiente)
- [ ] `INTERNAL_CRON_TOKEN` configurado com valor forte (ex: `openssl rand -hex 32`)
- [ ] Middleware validando variáveis de ambiente
- [ ] Build passa sem erros (`npm run build`)
- [ ] Lint passa sem erros (`npm run lint`)
- [ ] TypeScript sem erros (`npm run typecheck`)

### Runtime
- [ ] Middleware redireciona para `/login` se env ausente
- [ ] Middleware redireciona para `/login` se auth falhar
- [ ] `/api/alerts/evaluate` retorna 401 sem token válido
- [ ] Service Role Key não aparece em bundle do cliente
- [ ] RLS bloqueia acesso cross-workspace na UI
- [ ] Automação pode gravar alertas sem sessão

### Validação
```bash
# 1. Verificar que Service Role não está no bundle
npm run build
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/ || echo "OK: Não encontrado"

# 2. Testar middleware fail-closed
# Remover temporariamente NEXT_PUBLIC_SUPABASE_URL
# Acessar /app → deve redirecionar para /login?err=misconfig

# 3. Testar endpoint de automação
curl -X POST http://localhost:3000/api/alerts/evaluate
# Deve retornar 401

curl -X POST http://localhost:3000/api/alerts/evaluate \
  -H "Authorization: Bearer token-invalido"
# Deve retornar 401
```

---

## Logs e Auditoria

### Audit Logs
- Toda operação crítica grava em `audit_logs`
- Campos obrigatórios:
  - `workspace_id`
  - `actor_user_id` (NULL para automação)
  - `action` (`create`, `update`, `delete`)
  - `entity_type`, `entity_id`
  - `before`, `after` (JSON)

### Logs de Segurança
- Middleware loga erros de auth: `[middleware] Supabase auth error: ...`
- API de automação loga tentativas sem token: `[alerts:evaluate] INTERNAL_CRON_TOKEN não configurado`
- Admin client valida env apenas em runtime (não quebra build)

---

## Incident Response

### Se Service Role Key exposta:
1. **Imediato:** Rotacionar chave no Supabase Dashboard
2. Atualizar `SUPABASE_SERVICE_ROLE_KEY` em todos os ambientes
3. Revogar qualquer token gerado com a chave antiga
4. Revisar logs de acesso do período de exposição

### Se Token de Cron comprometido:
1. Gerar novo token: `openssl rand -hex 32`
2. Atualizar `INTERNAL_CRON_TOKEN` em todos os ambientes
3. Atualizar config do cron job/webhook
4. Revisar logs de `/api/alerts/evaluate`

---

## Referências

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

