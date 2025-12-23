# 🔧 Configuração do Browserless.io - Guia Completo

## ✅ Você já tem a API Key!

Na imagem que você compartilhou, vejo que você está logado no dashboard do Browserless e a API Key está visível na seção **"Sua chave de API"**.

---

## 📋 Passo 1: Copiar a API Key do Browserless

1. Na página inicial do Browserless (onde você está agora)
2. Localize a seção **"Sua chave de API"** (Your API key)
3. Clique no **ícone de copiar** (📋) ao lado da chave
4. Ou copie manualmente o valor completo (começa com `2TexwzuCvICt9k462eae6f537ba8c264be281d7b2690bb3f3...`)

**⚠️ IMPORTANTE:** Copie a chave COMPLETA, não apenas o início!

---

## 📝 Passo 2: Configurar no Projeto Local (.env.local)

### Editar/Criar arquivo `.env.local` na raiz do projeto:

```env
# Browserless.io Configuration
BROWSERLESS_URL=wss://chrome.browserless.io
BROWSERLESS_TOKEN=COLE_AQUI_SUA_API_KEY_COMPLETA

# Scraper Encryption Key (OBRIGATÓRIA para criptografar credenciais dos bancos)
SCRAPER_ENCRYPTION_KEY=2366a493938cafbe27632d3a050998c534cc72a767f1b8bf13a69851566978a5
```

**⚠️ IMPORTANTE:**
- `.env.local` não é versionado (já está no .gitignore)
- Nunca commite a API key no Git
- A `SCRAPER_ENCRYPTION_KEY` acima foi gerada para você - use esta mesma chave

---

## 🌐 Passo 3: Configurar na Vercel (Produção)

Para que os scrapers funcionem em produção:

1. Acesse: **https://vercel.com/[seu-projeto]/settings/environment-variables**
2. Clique em **"Add New"** para cada variável:

### Variável 1:
- **Name:** `BROWSERLESS_URL`
- **Value:** `wss://chrome.browserless.io`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

### Variável 2:
- **Name:** `BROWSERLESS_TOKEN`
- **Value:** `COLE_AQUI_SUA_API_KEY_COMPLETA` (a mesma que você copiou no Passo 1)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

### Variável 3:
- **Name:** `SCRAPER_ENCRYPTION_KEY`
- **Value:** `2366a493938cafbe27632d3a050998c534cc72a767f1b8bf13a69851566978a5`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

3. Clique em **"Save"** para cada variável
4. **Redeploy** o projeto na Vercel para aplicar as mudanças

---

## 🔑 URL do Browserless

O código está configurado para usar:
- **WebSocket URL:** `wss://chrome.browserless.io` (recomendado)
- **Alternativa HTTPS:** `https://chrome.browserless.io` (o código converte automaticamente para WebSocket)

✅ **Use:** `wss://chrome.browserless.io` (já está no exemplo acima)

---

## 🔐 Sobre a SCRAPER_ENCRYPTION_KEY

Esta chave é **OBRIGATÓRIA** e é usada para criptografar as credenciais dos bancos antes de salvar no banco de dados.

**Já gerei uma chave segura para você:**
```
2366a493938cafbe27632d3a050998c534cc72a767f1b8bf13a69851566978a5
```

**⚠️ IMPORTANTE:**
- Use a **MESMA chave** em `.env.local` e na Vercel
- Se você mudar esta chave depois, as credenciais já salvas não poderão ser descriptografadas
- Mantenha esta chave em segurança

---

## ✅ Resumo das Variáveis

| Variável | Valor | Onde Obter | Obrigatória? |
|----------|-------|------------|--------------|
| `BROWSERLESS_URL` | `wss://chrome.browserless.io` | Este guia | Não (usa local se não configurado) |
| `BROWSERLESS_TOKEN` | `sua_api_key_aqui` | Dashboard do Browserless | Não (usa local se não configurado) |
| `SCRAPER_ENCRYPTION_KEY` | `2366a493938cafbe27632d3a050998c534cc72a767f1b8bf13a69851566978a5` | Este guia | **SIM** |

---

## 🧪 Como Verificar se Está Funcionando

Após configurar:

1. **Localmente:**
   - Edite `.env.local` com os valores acima
   - Reinicie o servidor: `npm run dev`
   - Acesse `/app/scrapers` no navegador
   - Tente criar uma conexão com um banco

2. **Produção (Vercel):**
   - Configure as variáveis na Vercel
   - Faça um redeploy
   - Teste a funcionalidade de scrapers

---

## ⚠️ Modo Self-Hosted (Fallback)

Se você **NÃO configurar** `BROWSERLESS_URL` e `BROWSERLESS_TOKEN`:
- O sistema tentará usar Puppeteer local
- Funciona localmente, mas pode não funcionar na Vercel
- Não recomendado para produção

**Recomendação:** Configure o Browserless para produção.

---

## 🚀 Próximos Passos

1. ✅ Configurar `.env.local` localmente (Passo 2)
2. ✅ Configurar variáveis na Vercel (Passo 3)
3. ✅ Testar scraper do Itaú
4. ✅ Validar funcionamento

---

## 📞 Suporte

Se tiver problemas:
- Verifique se a API Key está completa (não cortada)
- Verifique se a URL usa `wss://` (WebSocket)
- Verifique se todas as 3 variáveis estão configuradas
- Verifique os logs do Browserless no dashboard

