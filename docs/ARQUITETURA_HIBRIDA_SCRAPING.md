# Arquitetura Híbrida: Scraping + Upload Manual

## Visão Geral

O sistema funcionará de forma **híbrida**:
- ✅ **Scraping Automático** (principal) - Acessa bancos automaticamente
- ✅ **Upload Manual** (fallback) - Quando scraping falhar ou você precisar

---

## Como Funciona

### 1. **Scraping Automático (Principal)**

```
┌─────────────────────────────────────┐
│ Agendamento Automático              │
│ (diário, semanal, mensal)           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Scraper acessa banco                │
│ - Login automático                  │
│ - Baixa extratos/faturas            │
│ - Converte para CSV                 │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Processamento Automático            │
│ - Usa lib/importers/spreadsheet     │
│ - Idempotência (não duplica)        │
│ - Conciliação automática            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Sistema Atualizado                  │
│ - Transações importadas             │
│ - Parcelas atualizadas              │
│ - Fluxo de caixa atualizado         │
└─────────────────────────────────────┘
```

### 2. **Upload Manual (Fallback)**

```
┌─────────────────────────────────────┐
│ Você baixa CSV manualmente          │
│ (quando scraping falhar)            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Upload via /app/import               │
│ - Mesmo processador                  │
│ - Mesma idempotência                 │
│ - Mesma conciliação                  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Sistema Atualizado                  │
│ (mesmo resultado do scraping)       │
└─────────────────────────────────────┘
```

---

## Idempotência (Não Duplica)

### Como Funciona

O sistema usa `external_id` para evitar duplicatas:

```typescript
// Scraping gera:
external_id = hash(data + descrição + valor + entity + account + "scraper")

// Upload manual gera:
external_id = hash(data + descrição + valor + entity + account + "csv")
```

**Resultado:**
- ✅ Mesma transação do scraping e upload manual = **não duplica**
- ✅ Transações diferentes = **importa ambas**
- ✅ Parcelas atualizadas = **atualiza, não duplica**

### Exemplo Prático

**Cenário 1: Scraping + Upload Manual da Mesma Transação**
```
1. Scraping importa: "Compra Supermercado - R$ 150,00"
   → external_id: "abc123"

2. Você faz upload manual do mesmo extrato
   → Sistema detecta: "abc123 já existe"
   → Pula (não duplica)
```

**Cenário 2: Parcelas Atualizadas**
```
1. Scraping importa: "Parcela 3/10 - R$ 150,00"
   → external_id: "parcela_3_abc123"

2. Próximo mês, scraping importa: "Parcela 4/10 - R$ 150,00"
   → external_id: "parcela_4_abc123"
   → Importa (é diferente)
   → Atualiza fluxo de caixa
```

---

## Recomendação de Plataforma

### **Browserless.io** (RECOMENDADO)

**Link:** https://www.browserless.io/pricing

**Planos:**
- **Starter:** $75/mês (100 horas de scraping)
- **Professional:** $200/mês (500 horas)
- **Enterprise:** Customizado

**Vantagens:**
- ✅ API simples e confiável
- ✅ Suporta Puppeteer/Playwright
- ✅ Anti-bot detection
- ✅ Proxy rotativo (opcional)
- ✅ Suporte 24/7

**Alternativa (Mais Barata):**

### **Self-Hosted (GRÁTIS)**

**Custo:** R$ 0/mês

**Como:**
- Hospedar Puppeteer/Playwright no seu servidor
- Vercel, Railway, ou servidor próprio
- Limitação: recursos do servidor

**Recomendação:** Começar com **Self-Hosted**, migrar para Browserless se necessário.

---

## Bancos a Implementar

### 1. **Itaú (PF e PJ)**
- Conta corrente
- Cartão de crédito
- Investimentos

### 2. **Santander**
- Conta corrente
- Cartão de crédito

### 3. **BTG Pactual**
- Banking
- Investimentos

### 4. **Mercado Pago**
- Cartões de crédito
- Conta digital

---

## Fluxo de Implementação

### Fase 1: Base (Semana 1)
- ✅ Estrutura base de scrapers
- ✅ Armazenamento seguro de credenciais
- ✅ Sistema de agendamento

### Fase 2: Scrapers (Semana 2)
- ✅ Itaú (PF e PJ)
- ✅ Santander
- ✅ BTG Pactual
- ✅ Mercado Pago

### Fase 3: Integração (Semana 3)
- ✅ Interface de configuração
- ✅ Notificações
- ✅ Logs e monitoramento

---

## Respostas às Suas Perguntas

### 1. **Uploads de planilhas já funcionam?**
✅ **SIM!** O sistema de upload está 100% funcional:
- `/app/import` - Interface de upload
- Validação robusta
- Preview antes de importar
- Conciliação automática
- Templates de CSV

### 2. **Quando scraper funcionar, ele atualizará valores?**
✅ **SIM!** O scraper:
- Usa o **mesmo processador** do upload manual
- Usa a **mesma idempotência** (não duplica)
- **Atualiza** transações existentes
- **Importa** novas transações
- **Concilia** automaticamente

### 3. **Vamos direto pro scraper ou manter upload?**
✅ **MANTER AMBOS:**
- **Scraping** = Principal (automático)
- **Upload** = Fallback (quando necessário)

**Por quê?**
- Se scraping falhar, você pode fazer upload manual
- Se banco mudar interface, você tem alternativa
- Flexibilidade total

---

## Próximos Passos

1. ✅ **Confirmar plataforma** (Browserless.io ou Self-hosted)
2. ✅ **Implementar base** de scrapers
3. ✅ **Criar scrapers** para bancos principais
4. ✅ **Integrar** com sistema existente
5. ✅ **Testar** e validar

**Tempo estimado:** 2-3 semanas
**Custo:** R$ 0-200/mês (dependendo da plataforma)

