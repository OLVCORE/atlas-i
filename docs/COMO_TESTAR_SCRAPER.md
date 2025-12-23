# 🧪 Como Testar o Scraper - Guia Completo

## ✅ O Que Está Funcionando AGORA

1. ✅ **Interface completa** de configuração
2. ✅ **Criptografia** de credenciais
3. ✅ **Teste de login REAL** - testa conexão real com o banco
4. ✅ **Armazenamento seguro** no banco
5. ⚠️ **Scraper Itaú** - estrutura básica (pode precisar ajustes)

---

## 🚀 Passo a Passo para Testar

### **1. Pré-requisitos**

✅ Ter conta no Itaú (PF ou PJ)
✅ Ter credenciais de acesso ao internet banking
✅ Ter `BROWSERLESS_URL` e `BROWSERLESS_TOKEN` configurados
✅ Ter `SCRAPER_ENCRYPTION_KEY` configurado

---

### **2. Criar Entidade**

1. Acesse `/app/entities`
2. Crie uma entidade (PF ou PJ)
3. Anote o nome da entidade

---

### **3. Configurar Scraper Itaú**

1. Acesse `/app/scrapers`
2. Clique em **"+ Nova Conexão"**
3. Preencha:
   - **Entidade:** Selecione a entidade criada
   - **Banco:** Selecione "Itaú"
   - **Usuário/CPF/CNPJ:** Digite seu CPF (sem pontos/traços) ou CNPJ
   - **Senha:** Digite sua senha do internet banking
4. Clique em **"🔒 Testar Conexão"**

**O que acontece:**
- Sistema faz login REAL no Itaú
- Verifica se credenciais estão corretas
- Retorna sucesso ou erro

**Se der sucesso:**
- ✅ Mensagem verde: "Login realizado com sucesso!"
- Você pode clicar em "Salvar Conexão"

**Se der erro:**
- ❌ Mensagem vermelha com detalhes
- Verifique se CPF e senha estão corretos
- Verifique se não há 2FA ativo (ainda não suportado)

---

### **4. Salvar Conexão**

1. Após teste bem-sucedido, clique em **"💾 Salvar Conexão"**
2. Sistema criptografa e salva credenciais
3. Conexão aparece na lista

---

### **5. Sincronizar (IMPORTANTE)**

1. Na lista de conexões, clique em **"🔄 Sincronizar"**
2. Aguarde sincronização

**O que acontece:**
```
1. Sistema descriptografa credenciais
2. Faz login no Itaú
3. Navega até página de extratos
4. Extrai transações
5. Importa no sistema
6. Atualiza fluxo de caixa
```

**Resultado esperado:**
- ✅ Mensagem: "Sincronização concluída! X transações importadas."
- Transações aparecem em `/app/ledger`
- Parcelas de cartão são baixadas automaticamente

---

## ⚠️ Problemas Conhecidos e Soluções

### **Problema 1: "Falha ao fazer login"**

**Causas possíveis:**
- CPF/CNPJ incorreto
- Senha incorreta
- 2FA ativo (não suportado ainda)
- Interface do Itaú mudou (seletores podem estar desatualizados)

**Solução:**
- Verifique credenciais
- Tente fazer login manual no site do Itaú para confirmar
- Se interface mudou, precisamos atualizar seletores no código

---

### **Problema 2: "Erro ao extrair transações"**

**Causas possíveis:**
- Interface do Itaú mudou
- Formato de extrato diferente
- Página não carregou completamente

**Solução:**
- Verifique logs no console
- Pode ser necessário ajustar seletores no código

---

### **Problema 3: "Nenhuma transação encontrada"**

**Causas possíveis:**
- Período sem transações
- Formato de data diferente
- Seletores incorretos

**Solução:**
- Verifique se há transações no período
- Pode precisar ajustar lógica de extração

---

## 🔍 Como Debugar

### **1. Ver Logs**

Os logs aparecem no console do servidor (Vercel logs ou terminal local).

### **2. Ver Screenshots**

O scraper captura screenshots quando há erros (quando implementado).

### **3. Testar Login Manualmente**

Antes de usar o scraper:
1. Abra o site do Itaú
2. Tente fazer login com as mesmas credenciais
3. Veja se funciona
4. Se funcionar manualmente mas não no scraper, pode ser problema de seletores

---

## 📝 Notas Importantes

### **2FA (Autenticação de Dois Fatores)**

- **Status:** Não totalmente suportado ainda
- **Solução temporária:** Desative 2FA para teste (não recomendado para produção)
- **Solução futura:** Implementar suporte a TOTP (Token)

### **Taxa de Sucesso**

O scraper pode falhar se:
- Interface do banco mudar
- Banco detectar automação (anti-bot)
- Requisitos especiais (captcha, etc.)

### **Manutenção**

Scrapers precisam de manutenção constante porque:
- Bancos mudam interfaces
- Adicionam medidas anti-bot
- Mudam fluxos de autenticação

---

## 🎯 Próximos Passos

1. ✅ Teste básico funcionando
2. 🔄 Melhorar extração de transações
3. 🔄 Adicionar suporte a 2FA
4. 🔄 Adicionar mais bancos (Santander, BTG, Mercado Pago)
5. 🔄 Melhorar tratamento de erros
6. 🔄 Adicionar screenshots de debug

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:
1. Verifique os logs
2. Tente login manual no site do banco
3. Verifique se credenciais estão corretas
4. Se interface mudou, pode precisar atualizar código

