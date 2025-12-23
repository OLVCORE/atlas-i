# 🔒 Segurança dos Scrapers Bancários

## Como Funciona a Segurança

### 1. **Criptografia das Credenciais**

- **Antes de salvar**: As credenciais (senha, 2FA secret) são **criptografadas** usando AES-256-GCM
- **Chave de criptografia**: Derivada do `workspace_id` + `SCRAPER_ENCRYPTION_KEY` (variável de ambiente)
- **Algoritmo**: AES-256-GCM (Advanced Encryption Standard com Galois/Counter Mode)
- **Resultado**: Credenciais são salvas no banco como string criptografada (não legível)

### 2. **Senha Nunca Exposta no DOM**

- ✅ A senha **NUNCA** é renderizada no HTML (`value` do input)
- ✅ Usamos estado separado (`passwordInput`) que não é persistido
- ✅ A senha só existe em memória enquanto o usuário digita
- ✅ Ao salvar, a senha é enviada via HTTPS e imediatamente criptografada no backend

### 3. **Fluxo de Segurança**

```
Usuário digita senha
  ↓
Estado em memória (passwordInput) - NÃO exposto no DOM
  ↓
Teste de conexão (opcional) - senha enviada via HTTPS
  ↓
Ao salvar: senha enviada via HTTPS para /api/scrapers/connect
  ↓
Backend criptografa usando workspace_id + SCRAPER_ENCRYPTION_KEY
  ↓
Senha criptografada salva no banco (credentials_encrypted)
  ↓
Senha original NUNCA mais é armazenada em texto plano
```

### 4. **Descriptografia (Apenas Quando Necessário)**

- As credenciais são descriptografadas **apenas** quando:
  - O scraper precisa fazer login no banco
  - A descriptografia acontece **no servidor**, nunca no cliente
- **Chave necessária**: `workspace_id` + `SCRAPER_ENCRYPTION_KEY`
- **Sem a chave**: Impossível descriptografar (mesmo tendo acesso ao banco)

### 5. **Proteções Implementadas**

✅ **Senha nunca no HTML**: Estado separado, nunca renderizado
✅ **HTTPS obrigatório**: Todas as requisições via HTTPS
✅ **Criptografia forte**: AES-256-GCM
✅ **Chave por workspace**: Cada workspace tem sua própria chave derivada
✅ **Variável de ambiente**: `SCRAPER_ENCRYPTION_KEY` não está no código
✅ **Teste antes de salvar**: Opção de testar conexão sem salvar

### 6. **O Que NÃO É Possível Fazer**

❌ **Ver senha no código HTML**: Senha nunca é renderizada
❌ **Descriptografar sem chave**: Sem `SCRAPER_ENCRYPTION_KEY` + `workspace_id`, é impossível
❌ **Acessar senha via inspeção**: Senha só existe em memória durante digitação
❌ **Ver senha no banco de dados**: Apenas string criptografada (ilegível)

### 7. **Recomendações de Segurança**

1. ✅ **Sempre use HTTPS** (Vercel já fornece)
2. ✅ **Proteja `SCRAPER_ENCRYPTION_KEY`**: Mantenha em variáveis de ambiente
3. ✅ **Teste conexão antes de salvar**: Use o botão "Testar Conexão"
4. ✅ **Não compartilhe workspace**: Cada workspace tem acesso apenas às próprias credenciais
5. ✅ **Revise permissões**: Apenas usuários do workspace podem acessar conexões

---

## Perguntas Frequentes

### "Minha senha está segura?"

**SIM.** A senha é criptografada antes de salvar e nunca é exposta no HTML ou código JavaScript visível.

### "Alguém pode ver minha senha inspecionando a página?"

**NÃO.** A senha nunca é renderizada no HTML. Mesmo inspecionando o código, você só veria um input vazio.

### "E se alguém tiver acesso ao banco de dados?"

**Credenciais criptografadas.** Sem a `SCRAPER_ENCRYPTION_KEY` e o `workspace_id`, é impossível descriptografar.

### "E se alguém tiver acesso ao código do servidor?"

**Ainda precisa da chave.** A `SCRAPER_ENCRYPTION_KEY` está em variável de ambiente, não no código.

### "Como funciona a criptografia?"

Usamos **AES-256-GCM**, um algoritmo de criptografia simétrica de alta segurança usado por governos e instituições financeiras.

---

## Verificação Técnica

Para verificar que a senha não está exposta:

1. Abra o DevTools (F12)
2. Vá na aba "Elements"
3. Procure pelo input de senha
4. **Você NÃO verá** `value="sua_senha_aqui"`
5. O input estará vazio ou com `value=""`

Isso garante que a senha nunca é exposta no DOM.

