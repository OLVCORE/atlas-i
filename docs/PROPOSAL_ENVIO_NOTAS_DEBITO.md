# Proposta: Envio de Notas de Débito via WhatsApp e Email

## 1. ENVIO VIA EMAIL

### Opção A: Resend (Recomendado - Mais Simples)
**Custo:** Gratuito até 3.000 emails/mês, depois $20/mês para 50.000 emails

**Vantagens:**
- ✅ API simples e moderna
- ✅ Excelente deliverability
- ✅ Suporte a anexos PDF
- ✅ Templates HTML
- ✅ Dashboard de analytics
- ✅ Integração rápida (1-2 horas)

**Implementação:**
1. Instalar: `npm install resend`
2. Criar API route: `/api/debit-notes/[id]/send-email`
3. Gerar PDF em memória
4. Enviar email com PDF anexado
5. Usar email da entidade (`entity.email`) ou campo manual

**Código Exemplo:**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'ATLAS-i <noreply@seudominio.com>',
  to: entity.email || clientEmail,
  subject: `Nota de Débito ${debitNote.number}`,
  html: `<p>Segue em anexo a nota de débito ${debitNote.number}...</p>`,
  attachments: [{
    filename: `nota-debito-${debitNote.number}.pdf`,
    content: pdfBuffer
  }]
})
```

**Configuração Necessária:**
- Variável de ambiente: `RESEND_API_KEY`
- Verificar domínio no Resend (para produção)

---

### Opção B: Nodemailer (Mais Flexível)
**Custo:** Depende do SMTP (Gmail gratuito, SendGrid pago, etc.)

**Vantagens:**
- ✅ Mais controle sobre configuração
- ✅ Suporta qualquer SMTP
- ✅ Pode usar Gmail, Outlook, etc.

**Desvantagens:**
- ⚠️ Configuração mais complexa
- ⚠️ Gmail tem limites (500 emails/dia)
- ⚠️ Pode ir para spam sem configuração adequada

**Implementação:**
1. Instalar: `npm install nodemailer`
2. Configurar SMTP (Gmail, SendGrid, etc.)
3. Criar API route similar ao Resend

---

## 2. ENVIO VIA WHATSAPP

### Opção A: Evolution API (Recomendado - Open Source)
**Custo:** Gratuito (self-hosted) ou ~R$ 50-200/mês (hosted)

**Vantagens:**
- ✅ Open source e gratuito
- ✅ Não precisa WhatsApp Business API oficial
- ✅ Suporta envio de documentos/PDFs
- ✅ Pode usar número pessoal ou Business
- ✅ API REST simples

**Desvantagens:**
- ⚠️ Requer servidor próprio ou serviço pago
- ⚠️ WhatsApp pode banir se abusar (spam)
- ⚠️ Precisa manter sessão ativa

**Implementação:**
1. Instalar Evolution API (Docker ou serviço)
2. Conectar número WhatsApp
3. Criar API route: `/api/debit-notes/[id]/send-whatsapp`
4. Enviar mensagem com PDF

**Código Exemplo:**
```typescript
const response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
  method: 'POST',
  headers: { 'apikey': EVOLUTION_API_KEY },
  body: JSON.stringify({
    number: phoneNumber, // +5511999999999
    mediaMessage: {
      mimetype: 'application/pdf',
      fileName: `nota-debito-${debitNote.number}.pdf`,
      media: pdfBuffer.toString('base64')
    },
    caption: `Nota de Débito ${debitNote.number} - Valor: R$ ${total}`
  })
})
```

---

### Opção B: Twilio WhatsApp API (Oficial)
**Custo:** ~$0.005 por mensagem (R$ 0,025)

**Vantagens:**
- ✅ API oficial do WhatsApp
- ✅ Mais confiável e estável
- ✅ Não corre risco de banimento
- ✅ Suporte oficial

**Desvantagens:**
- ⚠️ Mais caro (R$ 0,025 por envio)
- ⚠️ Precisa aprovação do WhatsApp Business
- ⚠️ Configuração mais complexa

---

### Opção C: Z-API / WppConnect (Brasileiro)
**Custo:** ~R$ 50-150/mês

**Vantagens:**
- ✅ Serviço brasileiro
- ✅ Suporte em português
- ✅ Fácil integração
- ✅ Suporta PDFs

**Desvantagens:**
- ⚠️ Custo mensal fixo
- ⚠️ Depende de serviço externo

---

## 3. IMPLEMENTAÇÃO SUGERIDA

### Fase 1: Email (Resend) - Prioridade Alta
- ✅ Implementação rápida (2-3 horas)
- ✅ Custo baixo/zero
- ✅ Alta confiabilidade
- ✅ Funciona imediatamente

### Fase 2: WhatsApp (Evolution API) - Prioridade Média
- ✅ Implementação média (4-6 horas)
- ✅ Custo baixo (self-hosted) ou médio (hosted)
- ✅ Alta adesão no Brasil
- ⚠️ Requer infraestrutura adicional

---

## 4. CAMPOS NECESSÁRIOS

**Na tabela `entities`:**
- ✅ `email` (já existe)
- ✅ `phone` (já existe)

**Na tabela `debit_notes`:**
- ✅ `client_name` (já existe)
- ⚠️ `client_email` (opcional - email específico do cliente)
- ⚠️ `client_phone` (opcional - telefone específico do cliente)

**Ou usar:**
- Email: `entity.email` ou `debitNote.client_email` (se preenchido)
- WhatsApp: `entity.phone` ou `debitNote.client_phone` (se preenchido)

---

## 5. UI SUGERIDA

**Na tabela de notas de débito:**
- Botão "Enviar" (ícone de envelope/WhatsApp)
- Dropdown com opções:
  - 📧 Enviar por Email
  - 📱 Enviar por WhatsApp
  - 📧📱 Enviar por Email e WhatsApp

**Modal de confirmação:**
- Mostrar destinatário (email/telefone)
- Permitir editar antes de enviar
- Mostrar preview da mensagem
- Botão "Enviar"

---

## 6. ESTIMATIVA DE CUSTOS

**Email (Resend):**
- 0-3.000 emails/mês: **GRÁTIS**
- 3.000-50.000 emails/mês: **$20/mês (~R$ 100)**

**WhatsApp (Evolution API):**
- Self-hosted: **GRÁTIS** (apenas servidor)
- Hosted (serviço terceiro): **R$ 50-200/mês**

**WhatsApp (Twilio):**
- Por mensagem: **R$ 0,025**
- 100 notas/mês: **R$ 2,50**
- 1.000 notas/mês: **R$ 25**

---

## RECOMENDAÇÃO FINAL

**Começar com Email (Resend):**
1. Implementação rápida
2. Custo zero inicial
3. Alta confiabilidade
4. Funciona para todos os clientes

**Adicionar WhatsApp depois (Evolution API):**
1. Alta adesão no Brasil
2. Custo razoável
3. Complementa o email
