# MC1 - Configuração de Confirmação de E-mail

## Problema

Ao criar uma conta, não está recebendo e-mail de confirmação e não consegue fazer login (erro 400).

## Causa

O Supabase está configurado para exigir confirmação de e-mail antes de permitir login. Se a confirmação estiver habilitada:

1. O usuário é criado no banco
2. Um e-mail de confirmação é enviado
3. O usuário NÃO pode fazer login até clicar no link do e-mail
4. Se o e-mail não chegar ou for ignorado, o login falha com erro 400

## Solução 1: Desabilitar Confirmação de E-mail (Recomendado para Desenvolvimento)

Para testes e desenvolvimento, é recomendado desabilitar a confirmação de e-mail:

### Passos:

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/vydsayvhovuqfdelxtko

2. **Vá para Authentication:**
   - Menu lateral > **Authentication**

3. **Acesse Providers:**
   - Clique em **Providers**

4. **Configure Email Provider:**
   - Localize **Email** na lista
   - Clique para expandir as opções
   - **DESABILITE** a opção **"Confirm email"** (toggle deve ficar cinza/desligado)
   - Clique em **Save**

5. **Resultado:**
   - Após desabilitar, novos usuários poderão fazer login imediatamente após criar a conta
   - Usuários já criados que não confirmaram o e-mail precisarão ser deletados ou confirmados manualmente

### Confirmar Usuários Existentes Manualmente (se necessário):

Se você já criou usuários que não confirmaram, pode confirmá-los manualmente via SQL:

1. **SQL Editor no Supabase:**
   ```sql
   -- Ver usuários não confirmados
   SELECT id, email, email_confirmed_at, created_at 
   FROM auth.users 
   WHERE email_confirmed_at IS NULL;
   
   -- Confirmar um usuário específico (substitua o email)
   UPDATE auth.users 
   SET email_confirmed_at = NOW() 
   WHERE email = 'seu@email.com';
   ```

## Solução 2: Configurar E-mail SMTP (Para Produção)

Se você quiser manter a confirmação de e-mail ativa (recomendado para produção), precisa configurar SMTP:

### Passos:

1. **Acesse Authentication > Settings:**
   - Menu: **Authentication** > **Settings**

2. **Configure SMTP:**
   - Role até a seção **SMTP Settings**
   - Configure seu provedor de e-mail (Gmail, SendGrid, etc.)
   - Salve as configurações

3. **Teste o envio:**
   - Crie uma nova conta
   - Verifique se o e-mail de confirmação chega

## Solução 3: Verificar E-mail de Confirmação (Se já foi enviado)

Se a confirmação estiver habilitada e você não recebeu o e-mail:

1. **Verifique a pasta de spam/lixo eletrônico**
2. **Verifique se o e-mail foi digitado corretamente**
3. **Verifique os logs do Supabase:**
   - Dashboard > Logs > Auth logs
   - Procure por tentativas de envio de e-mail

## Comportamento Após Ajustes

### Com Confirmação DESABILITADA (Desenvolvimento):
- ✅ Signup cria usuário e permite login imediato
- ✅ Não há necessidade de verificar e-mail
- ✅ Melhor para testes e desenvolvimento rápido

### Com Confirmação HABILITADA (Produção):
- ✅ Signup cria usuário e envia e-mail
- ✅ Usuário precisa clicar no link do e-mail
- ✅ Após confirmar, pode fazer login
- ✅ Mais seguro para produção

## Recomendação para MC1

**Para desenvolvimento e testes do MC1, desabilite a confirmação de e-mail.**

Você pode reabilitar quando for para produção ou quando configurar SMTP adequadamente.

## Código Atualizado

O código agora detecta quando o signup é bem-sucedido mas requer confirmação de e-mail e mostra uma mensagem apropriada ao usuário, orientando sobre o que fazer.

