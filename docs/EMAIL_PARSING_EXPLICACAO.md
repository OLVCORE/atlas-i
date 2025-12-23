# Email Parsing - Explicação Completa

## O que é Email Parsing?

**Email Parsing** é uma técnica que permite ao sistema **ler e processar emails automaticamente** para extrair informações úteis (como extratos bancários) e importá-las no sistema sem intervenção manual.

---

## Como Funcionaria no ATLAS-i?

### Cenário Real:

1. **Você recebe email do banco:**
   ```
   De: extrato@banco.com.br
   Para: seu-email@gmail.com
   Assunto: Extrato Conta Corrente - Janeiro 2024
   Anexo: extrato_jan_2024.csv
   ```

2. **Você encaminha para o sistema:**
   ```
   De: seu-email@gmail.com
   Para: extratos@atlas-i.com (ou extratos@seudominio.com)
   Assunto: Fwd: Extrato Conta Corrente - Janeiro 2024
   Anexo: extrato_jan_2024.csv
   ```

3. **Sistema processa automaticamente:**
   - Detecta o email recebido
   - Extrai o anexo CSV
   - Identifica o banco (pelo remetente ou assunto)
   - Processa as transações
   - Importa no sistema
   - Concilia com schedules/commitments
   - Envia notificação de sucesso

4. **Você recebe notificação:**
   ```
   ✅ Importação concluída!
   - 45 transações importadas
   - 3 parcelas conciliadas automaticamente
   - 2 duplicatas puladas
   ```

---

## Vantagens

### ✅ **Automação Total**
- Não precisa abrir o sistema
- Não precisa fazer upload manual
- Apenas encaminhar o email

### ✅ **Funciona com Qualquer Banco**
- Banco do Brasil
- Itaú
- Bradesco
- Nubank
- Qualquer banco que envia extratos por email

### ✅ **Baixo Custo**
- **Opção 1 (Grátis):** IMAP direto (você configura seu email)
- **Opção 2 (Pago):** Serviços como Resend/SendGrid (~$10-20/mês)

### ✅ **Tempo Real**
- Assim que você encaminha, o sistema processa
- Não precisa esperar

---

## Como Seria Implementado?

### Arquitetura:

```
┌─────────────────────────────────────┐
│ 1. Email Recebido                   │
│    (via webhook ou IMAP)            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 2. Parser de Email                  │
│    - Extrai anexo                   │
│    - Identifica banco               │
│    - Valida formato                 │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 3. Processador de Extrato           │
│    - Usa lib/importers/csv-parser   │
│    - Usa lib/importers/spreadsheet  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 4. Importação Automática            │
│    - Cria transações                 │
│    - Concilia com schedules          │
│    - Baixa parcelas de cartão        │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ 5. Notificação                      │
│    - Email de sucesso/erro          │
│    - Dashboard atualizado            │
└─────────────────────────────────────┘
```

### Arquivos que seriam criados:

1. **`app/api/import/email/route.ts`**
   - Endpoint que recebe webhook de email
   - Processa email recebido

2. **`lib/importers/email-parser.ts`**
   - Extrai anexos de emails
   - Identifica banco pelo remetente
   - Valida formato

3. **`lib/importers/email-processor.ts`**
   - Orquestra todo o processo
   - Chama importador existente
   - Envia notificações

---

## Exemplo de Uso Diário

### **Antes (Manual):**
1. Banco envia email com extrato
2. Você baixa o CSV
3. Abre o sistema ATLAS-i
4. Vai em "Importar Planilha"
5. Seleciona arquivo
6. Configura entidade/conta
7. Clica em "Importar"
8. Aguarda processamento

**Tempo:** ~5 minutos por extrato

### **Depois (Com Email Parsing):**
1. Banco envia email com extrato
2. Você encaminha para `extratos@atlas-i.com`
3. **Pronto!** Sistema processa automaticamente

**Tempo:** ~10 segundos (só encaminhar)

---

## Custos

### Opção 1: IMAP Direto (GRÁTIS)
- Você configura seu email (Gmail, Outlook, etc.)
- Sistema acessa via IMAP
- **Custo:** R$ 0,00

### Opção 2: Serviço de Email (PAGO)
- Resend: ~$10/mês (até 50k emails)
- SendGrid: ~$15/mês (até 40k emails)
- **Custo:** ~R$ 50-75/mês

---

## Segurança

- ✅ Emails processados são deletados após importação
- ✅ Anexos são validados antes de processar
- ✅ Apenas emails de remetentes autorizados são processados
- ✅ Logs de todas as importações

---

## Próximos Passos

Se você quiser implementar, eu posso criar:

1. **Endpoint de webhook** para receber emails
2. **Parser de email** para extrair anexos
3. **Processador automático** que usa o importador existente
4. **Sistema de notificações** para avisar sobre importações

**Tempo de implementação:** ~2-3 horas
**Custo mensal:** R$ 0-75 (dependendo da opção)

---

## Conclusão

Email Parsing transforma o processo manual de importação em um processo **100% automatizado**, onde você apenas **encaminha emails** e o sistema faz todo o resto.

É a solução ideal para quem:
- Recebe extratos por email regularmente
- Quer automação sem depender de APIs de banco
- Quer baixo custo (ou grátis)
- Quer simplicidade (só encaminhar email)

