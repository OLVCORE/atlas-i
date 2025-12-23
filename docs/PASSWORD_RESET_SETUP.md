# Configuração de Recuperação de Senha (Password Reset)

## Funcionalidade Implementada

O sistema agora possui funcionalidade completa de recuperação de senha, igual às grandes plataformas mundiais:

1. **Página "Esqueci minha senha"** (`/forgot-password`)
   - Usuário informa o e-mail
   - Sistema envia link de redefinição por e-mail
   - Mensagem genérica (não revela se e-mail existe, por segurança)

2. **Página "Redefinir senha"** (`/reset-password`)
   - Recebe token do link enviado por e-mail
   - Permite definir nova senha
   - Validação: senha mínima 6 caracteres, confirmação deve coincidir
   - Redireciona para login após sucesso

3. **Link "Esqueci minha senha"** na página de login
   - Fácil acesso à funcionalidade

## Fluxo Completo

```
1. Usuário acessa /login
2. Clica em "Esqueci minha senha"
3. Digita e-mail em /forgot-password
4. Recebe e-mail com link de redefinição
5. Clica no link → redireciona para /reset-password?token=...
6. Define nova senha
7. Redirecionado para /login
8. Faz login com nova senha
```

## Configuração no Supabase

### 1. Configurar URL de Redirecionamento

**Acesse:** Supabase Dashboard → Authentication → URL Configuration

Adicione na lista de **Redirect URLs**:
```
http://localhost:3000/reset-password
https://seu-dominio.com/reset-password
```

### 2. Configurar Template de E-mail (Opcional)

**Acesse:** Supabase Dashboard → Authentication → Email Templates → Reset Password

O template padrão já funciona, mas você pode personalizar:

```html
<h2>Redefinir sua senha</h2>
<p>Clique no link abaixo para redefinir sua senha:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir senha</a></p>
<p>Se você não solicitou esta redefinição, ignore este e-mail.</p>
```

**Variáveis disponíveis:**
- `{{ .ConfirmationURL }}` - Link de redefinição
- `{{ .Email }}` - E-mail do usuário
- `{{ .SiteURL }}` - URL do site

### 3. Configurar SMTP (Obrigatório para produção)

Para que os e-mails sejam enviados, configure SMTP no Supabase:

**Acesse:** Supabase Dashboard → Authentication → Settings → SMTP Settings

**Exemplo com Gmail:**
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: seu-email@gmail.com
SMTP Password: [App Password do Gmail]
Sender Email: seu-email@gmail.com
Sender Name: ATLAS-i
```

**Exemplo com SendGrid:**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [API Key do SendGrid]
Sender Email: noreply@seu-dominio.com
Sender Name: ATLAS-i
```

## Segurança

### Proteções Implementadas

1. **Não revela se e-mail existe**
   - Mesmo se e-mail não estiver cadastrado, mostra mensagem genérica de sucesso
   - Previne enumeração de usuários

2. **Token único e temporário**
   - Link gerado pelo Supabase tem token único
   - Token expira após tempo determinado (configurável no Supabase)

3. **Validação de senha**
   - Mínimo 6 caracteres (conforme política do Supabase)
   - Confirmação deve coincidir

4. **Rate limiting**
   - Supabase aplica rate limiting automaticamente
   - Previne spam de requisições

## Testando

### 1. Teste Completo

1. Acesse `/login`
2. Clique em "Esqueci minha senha"
3. Digite um e-mail cadastrado
4. Verifique o e-mail recebido (ou logs do Supabase em dev)
5. Clique no link
6. Defina nova senha
7. Faça login com a nova senha

### 2. Teste em Desenvolvimento (sem SMTP)

Se SMTP não estiver configurado:

1. Acesse: Supabase Dashboard → Logs → Auth Logs
2. Solicite redefinição de senha
3. Encontre o log com o link completo
4. Copie e cole no navegador

### 3. Teste de Validações

- Tente redefinir senha sem preencher campos
- Tente com senha muito curta (< 6 caracteres)
- Tente com senhas diferentes (password ≠ confirmPassword)
- Tente com link expirado (aguarde expiração do token)

## Troubleshooting

### Link não chega no e-mail

1. Verifique configuração SMTP no Supabase
2. Verifique pasta de spam
3. Verifique logs do Supabase (Auth Logs)
4. Verifique se Redirect URL está configurada corretamente

### Link inválido ou expirado

1. Tokens expiram após período determinado (padrão: 1 hora)
2. Cada token só pode ser usado uma vez
3. Solicite novo link se necessário

### Erro "password should be at least"

- Senha deve ter mínimo 6 caracteres
- Esta é política do Supabase

### Redirecionamento não funciona

1. Verifique Redirect URLs no Supabase
2. Verifique se URL inclui protocolo (http/https)
3. Verifique se URL corresponde exatamente ao domínio

## Customização

### Personalizar Mensagens

Edite os textos diretamente nos arquivos:
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`

### Personalizar Validações

Edite a função `validatePassword()` em `app/reset-password/page.tsx` para:
- Adicionar requisitos de complexidade (maiúsculas, números, símbolos)
- Alterar tamanho mínimo
- Adicionar verificações customizadas

### Personalizar Template de E-mail

No Supabase Dashboard → Authentication → Email Templates → Reset Password

Use HTML e variáveis do Go Template:
- `{{ .ConfirmationURL }}`
- `{{ .Email }}`
- `{{ .SiteURL }}`

## Checklist de Implementação

- [x] Página `/forgot-password` criada
- [x] Página `/reset-password` criada
- [x] Link "Esqueci minha senha" na página de login
- [x] Integração com Supabase `resetPasswordForEmail`
- [x] Integração com Supabase `updateUser`
- [x] Validações de senha
- [x] Mensagens de erro amigáveis
- [x] Mensagens de sucesso
- [x] Redirecionamento após sucesso
- [x] Proteção contra enumeração de usuários
- [ ] SMTP configurado no Supabase
- [ ] Redirect URLs configuradas no Supabase
- [ ] Template de e-mail personalizado (opcional)
- [ ] Testes realizados

## Referências

- [Supabase Password Reset](https://supabase.com/docs/guides/auth/auth-password-reset)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SMTP Configuration](https://supabase.com/docs/guides/auth/auth-smtp)

