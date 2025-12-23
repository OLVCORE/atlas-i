# Browserless.io - Explicação de Planos e Concurrencies

## O que é "Concurrency"?

**Concurrency = Navegadores Simultâneos**

Não é sobre:
- ❌ Número de entidades
- ❌ Número de bancos
- ❌ Número de conexões

É sobre:
- ✅ **Quantos scrapings podem rodar AO MESMO TEMPO**

---

## Exemplo Prático

### Cenário 1: Starter (20 concurrencies)

```
Você tem:
- 4 bancos (Itaú, Santander, BTG, Mercado Pago)
- 3 entidades (PF + 2 CNPJs)
- Total: 12 conexões possíveis

Com Starter (20 concurrencies):
✅ Pode rodar 20 scrapings simultâneos
✅ Pode ter TODAS as 12 conexões rodando ao mesmo tempo
✅ Ainda sobra 8 slots para outras operações
```

### Cenário 2: Prototyping (3 concurrencies)

```
Com Prototyping (3 concurrencies):
⚠️ Pode rodar apenas 3 scrapings simultâneos
⚠️ Se tiver 4 bancos, precisa rodar em sequência
⚠️ Mais lento, mas funciona
```

---

## Planos Browserless.io

### **Prototyping - $25/mês**
- **20k units/mês** (unidades de scraping)
- **3 concurrencies** (3 navegadores simultâneos)
- **15 min** máximo por sessão
- **7 dias** de logs

**Ideal para:** Testes e desenvolvimento

### **Starter - $140/mês** ⭐ RECOMENDADO
- **180k units/mês** (unidades de scraping)
- **20 concurrencies** (20 navegadores simultâneos)
- **30 min** máximo por sessão
- **30 dias** de logs
- **Suporte** email, chat e vídeo

**Ideal para:** Produção com múltiplos bancos/entidades

### **Scale - $350/mês**
- **500k units/mês**
- **50 concurrencies** (50 navegadores simultâneos)
- **60 min** máximo por sessão
- **90 dias** de logs

**Ideal para:** Alto volume

---

## O que é "Unit"?

**1 Unit = 1 segundo de navegador ativo**

Exemplo:
- Scraping do Itaú leva ~2 minutos = 120 units
- Scraping do Santander leva ~1 minuto = 60 units
- Scraping do BTG leva ~3 minutos = 180 units

**Cálculo mensal:**
```
4 bancos × 2 scrapings/dia × 30 dias = 240 scrapings/mês

Média por scraping: 2 minutos = 120 units
Total: 240 × 120 = 28.800 units/mês

Starter tem 180k units = SOBRA MUITO! ✅
```

---

## Recomendação para Seu Caso

### **Cenário Real:**
- 4 bancos (Itaú, Santander, BTG, Mercado Pago)
- 3 entidades (PF + 2 CNPJs)
- Total: 12 conexões possíveis
- Frequência: Diária ou semanal

### **Plano Ideal: Starter ($140/mês)**

**Por quê?**
- ✅ **20 concurrencies** = Pode rodar todas as 12 conexões simultaneamente
- ✅ **180k units/mês** = Muito mais que suficiente
- ✅ **30 min/sessão** = Tempo suficiente para scraping complexo
- ✅ **30 dias de logs** = Histórico completo
- ✅ **Suporte** = Ajuda quando precisar

**Custo-benefício:**
- R$ 700/mês (Starter) vs R$ 2.500/mês (Pluggy)
- **Economia de 72%** 🎉

---

## Alternativa: Self-Hosted (GRÁTIS)

### **Opção 1: Vercel (Grátis)**
- Limitação: Funções serverless (10s timeout)
- **NÃO recomendado** para scraping (muito lento)

### **Opção 2: Railway ($5-20/mês)**
- Servidor dedicado
- Pode rodar Puppeteer
- **Recomendado** para começar

### **Opção 3: Servidor Próprio (R$ 0-50/mês)**
- VPS (DigitalOcean, Linode, etc.)
- Controle total
- **Recomendado** se já tem servidor

---

## Comparação Final

| Solução | Custo/mês | Concurrencies | Units/mês | Recomendação |
|---------|-----------|---------------|-----------|--------------|
| **Self-Hosted (Railway)** | R$ 25-100 | Ilimitado* | Ilimitado* | ⭐ Começar aqui |
| **Browserless Starter** | R$ 700 | 20 | 180k | ⭐ Produção |
| **Browserless Scale** | R$ 1.750 | 50 | 500k | Para alto volume |
| **Pluggy** | R$ 2.500 | N/A | N/A | ❌ Muito caro |

*Limitado apenas pelos recursos do servidor

---

## Estratégia Recomendada

### **Fase 1: Desenvolvimento (Agora)**
- ✅ **Self-hosted** (Railway ou servidor próprio)
- ✅ Custo: R$ 0-100/mês
- ✅ Testar e desenvolver scrapers

### **Fase 2: Produção (Depois)**
- ✅ **Browserless Starter** ($140/mês)
- ✅ Mais confiável
- ✅ Melhor suporte
- ✅ Logs e monitoramento

---

## Resposta Direta

**"3 concurrencies significa 3 entidades ou 3 bancos?"**

**NÃO!** Significa **3 navegadores rodando simultaneamente**.

**Para seu caso:**
- 4 bancos × 3 entidades = 12 conexões possíveis
- **Starter (20 concurrencies)** = Pode rodar todas simultaneamente ✅
- **Prototyping (3 concurrencies)** = Precisa rodar em sequência ⚠️

**Recomendação:** Começar com **Self-hosted** (grátis/barato) e migrar para **Starter** quando estiver em produção.

