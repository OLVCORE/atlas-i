# Configuração do Magic Link

## Por que o Magic Link não está chegando no email?

Em **desenvolvimento**, o Supabase **não envia emails reais** por padrão. Você precisa configurar SMTP para emails funcionarem.

## Soluções

### 1. Para Desenvolvimento Rápido (Recomendado)

**Usar logs do Supabase para pegar o link:**

1. Acesse **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Quando você solicitar o magic link, aparecerá um log com o link completo
3. Copie e cole o link no navegador para fazer login

**OU configurar SMTP para desenvolvimento:**

### 2. Configurar SMTP no Supabase (Produção ou Dev Real)

#### Opção A: Gmail (Desenvolvimento)

1. **Supabase Dashboard** → **Authentication** → **Settings** → **SMTP Settings**
2. Configure:
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   SMTP User: seu-email@gmail.com
   SMTP Password: [App Password do Gmail - não a senha normal]
   Sender Email: seu-email@gmail.com
   Sender Name: ATLAS-i
   ```

**Como gerar App Password no Gmail:**
- Acesse: https://myaccount.google.com/apppasswords
- Gere uma senha de app específica
- Use essa senha no Supabase (não a senha normal do Gmail)

#### Opção B: SendGrid, Mailgun, ou outros serviços

Configure conforme a documentação do serviço escolhido.

### 3. Verificar Configuração de Email

**No Supabase Dashboard:**

1. **Authentication** → **URL Configuration**
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: Adicione `http://localhost:3000/app`

2. **Authentication** → **Email Templates**
   - **Magic Link** template deve estar configurado
   - O link deve usar `{{ .ConfirmationURL }}` ou `{{ .RedirectTo }}`

### 4. Verificar Logs

Se configurou SMTP mas ainda não recebe:

1. **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Procure por erros de envio de email
3. Verifique se o SMTP está configurado corretamente

### 5. Email vai para Spam

- Verifique a pasta de spam
- Configure SPF/DKIM no seu domínio (para produção)
- Use um serviço de email confiável (SendGrid, Mailgun, etc.)

## Para Desenvolvimento Local Rápido

**Solução mais simples:** Use os logs do Supabase ou configure um SMTP local como **MailHog** ou **Mailtrap**.

### MailHog (Local, Grátis)

1. Instale MailHog: https://github.com/mailhog/MailHog
2. Rode: `MailHog`
3. Configure no Supabase:
   ```
   SMTP Host: localhost
   SMTP Port: 1025
   SMTP User: (vazio)
   SMTP Password: (vazio)
   Sender Email: teste@localhost
   ```
4. Acesse http://localhost:8025 para ver os emails

## Template do Magic Link

O template padrão no Supabase deve ser algo como:

```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

Se você modificou o template, certifique-se de que:
- `{{ .ConfirmationURL }}` está presente
- O link aponta para o destino correto

## Checklist de Troubleshooting

- [ ] SMTP configurado no Supabase?
- [ ] Site URL e Redirect URLs configurados corretamente?
- [ ] Verificou os logs do Supabase?
- [ ] Verificou a pasta de spam?
- [ ] Template do email está correto?
- [ ] App Password do Gmail está correto (se usando Gmail)?

## Conclusão

**Para desenvolvimento rápido:** Use os logs do Supabase ou configure MailHog localmente.

**Para produção:** Configure SMTP adequado (SendGrid, Mailgun, AWS SES, etc.).

