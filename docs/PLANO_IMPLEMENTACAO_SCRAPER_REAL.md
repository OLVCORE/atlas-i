# 🔧 Plano de Implementação do Scraper Real

## 🎯 Objetivo

Implementar scraper **REAL** do Itaú que:
1. Faz login real no internet banking
2. Extrai transações reais
3. Importa no sistema automaticamente

---

## 📋 Etapas de Implementação

### **ETAPA 1: Estrutura Base (JÁ FEITA)**

✅ Base scraper criada (`lib/scrapers/base.ts`)
✅ Criptografia implementada
✅ Interface criada
✅ Armazenamento no banco

---

### **ETAPA 2: Login Real do Itaú**

**Arquivo:** `lib/scrapers/banks/itau.ts`

**O que precisa ser feito:**

1. **Navegar até página de login**
   ```typescript
   await this.page.goto('https://www.itau.com.br/internet-banking')
   ```

2. **Preencher CPF/CNPJ**
   ```typescript
   await this.page.type('#campo_cpf', credentials.username)
   ```

3. **Clicar em "Continuar"**
   ```typescript
   await this.page.click('#btnLoginSubmit')
   ```

4. **Aguardar página de senha**
   ```typescript
   await this.page.waitForSelector('#campo_senha')
   ```

5. **Preencher senha**
   ```typescript
   await this.page.type('#campo_senha', credentials.password)
   ```

6. **Clicar em "Entrar"**
   ```typescript
   await this.page.click('#btnLogin')
   ```

7. **Tratar 2FA (se necessário)**
   ```typescript
   if (credentials.twoFactorSecret) {
     // Gerar código TOTP
     const code = generateTOTP(credentials.twoFactorSecret)
     await this.page.type('#campo_2fa', code)
     await this.page.click('#btn2FA')
   }
   ```

8. **Aguardar login completo**
   ```typescript
   await this.page.waitForNavigation()
   // Verificar se está logado (não está mais na página de login)
   ```

---

### **ETAPA 3: Extrair Transações**

**O que precisa ser feito:**

1. **Navegar até extrato**
   ```typescript
   await this.page.goto('https://www.itau.com.br/internet-banking/extrato')
   ```

2. **Aguardar carregamento**
   ```typescript
   await this.page.waitForSelector('.extrato-table')
   ```

3. **Extrair linhas da tabela**
   ```typescript
   const transactions = await this.page.evaluate(() => {
     const rows = document.querySelectorAll('.extrato-table tbody tr')
     return Array.from(rows).map(row => {
       const cells = row.querySelectorAll('td')
       return {
         date: cells[0].textContent.trim(),
         description: cells[1].textContent.trim(),
         amount: cells[2].textContent.trim(),
         type: cells[3].textContent.trim(),
       }
     })
   })
   ```

4. **Processar e normalizar dados**
   ```typescript
   const normalizedTransactions = transactions.map(tx => ({
     date: parseDate(tx.date), // Converter para ISO
     description: tx.description,
     amount: parseAmount(tx.amount), // Converter para número
     type: tx.type === 'Crédito' ? 'income' : 'expense',
   }))
   ```

---

### **ETAPA 4: Integrar com Sistema**

**Arquivo:** `lib/scrapers/sync.ts`

**O que já está feito:**
- ✅ Estrutura de sync
- ✅ Integração com importador
- ✅ Logging

**O que precisa ser ajustado:**
- Garantir que o scraper retorna dados no formato correto
- Mapear para o formato esperado pelo importador

---

### **ETAPA 5: Testar Conexão Real**

**Endpoint:** `/api/scrapers/test-connection`

**O que precisa ser feito:**

1. Criar instância do scraper
2. Tentar fazer login
3. Verificar se login foi bem-sucedido
4. **NÃO fazer scraping completo** (só testar login)
5. Retornar sucesso/erro

```typescript
export async function POST(request: NextRequest) {
  // ... validações ...
  
  try {
    const scraper = createScraper(bankCode, {
      username,
      password,
      entityId: '', // Não precisa para teste
      twoFactorSecret,
    })
    
    // Testar apenas login
    const loginSuccess = await scraper.testLogin()
    
    if (loginSuccess) {
      return NextResponse.json({
        ok: true,
        connectionTest: {
          success: true,
          message: 'Login realizado com sucesso!',
        },
      })
    } else {
      return NextResponse.json({
        ok: false,
        connectionTest: {
          success: false,
          message: 'Falha ao fazer login. Verifique as credenciais.',
        },
      })
    }
  } catch (error) {
    // ...
  }
}
```

---

## 🛠️ Dependências Necessárias

### **Bibliotecas:**

```json
{
  "puppeteer": "^21.0.0",
  "otplib": "^12.0.1" // Para 2FA/TOTP
}
```

### **Variáveis de Ambiente:**

```env
BROWSERLESS_URL=wss://chrome.browserless.io
BROWSERLESS_TOKEN=sua_token
SCRAPER_ENCRYPTION_KEY=sua_chave
```

---

## 📝 Estrutura de Código

### **Base Scraper (`lib/scrapers/base.ts`)**

```typescript
abstract class BaseScraper {
  // Método abstrato - cada banco implementa
  abstract login(): Promise<boolean>
  abstract extractTransactions(): Promise<Transaction[]>
  
  // Método público para testar login
  async testLogin(): Promise<boolean> {
    try {
      await this.initBrowser()
      return await this.login()
    } catch (error) {
      return false
    }
  }
  
  // Método público para fazer scraping completo
  async scrape(): Promise<ScrapingResult> {
    await this.initBrowser()
    const loggedIn = await this.login()
    if (!loggedIn) {
      throw new Error('Falha ao fazer login')
    }
    const transactions = await this.extractTransactions()
    return {
      success: true,
      transactions,
      // ...
    }
  }
}
```

### **Itaú Scraper (`lib/scrapers/banks/itau.ts`)**

```typescript
class ItauScraper extends BaseScraper {
  async login(): Promise<boolean> {
    // Implementar login específico do Itaú
  }
  
  async extractTransactions(): Promise<Transaction[]> {
    // Implementar extração específica do Itaú
  }
}
```

---

## ⚠️ Desafios e Considerações

### **1. Anti-Bot Detection**

Bancos têm sistemas anti-bot. Precisa:
- User agent realista
- Delays entre ações
- Comportamento humano (movimentos de mouse, etc.)
- Headless pode ser detectado (Browserless ajuda)

### **2. Mudanças na Interface**

Bancos mudam interfaces frequentemente. Precisa:
- Seletores robustos
- Fallbacks
- Monitoramento de erros
- Atualização constante

### **3. 2FA/TOTP**

Implementar geração de códigos:
- Usar biblioteca `otplib`
- Gerar código baseado no secret
- Inserir no campo correto

### **4. Rate Limiting**

Não fazer muitas requisições:
- Respeitar delays
- Não sincronizar muito frequente
- Cache quando possível

---

## 🚀 Ordem de Implementação Recomendada

1. ✅ **Estrutura base** (JÁ FEITO)
2. 🔄 **Login Itaú básico** (PRÓXIMO)
3. 🔄 **Teste de conexão real**
4. 🔄 **Extração de transações**
5. 🔄 **Teste completo**
6. 🔄 **Tratamento de erros**
7. 🔄 **Outros bancos**

---

## 📊 Critérios de Sucesso

- ✅ Login funciona com credenciais reais
- ✅ Extrai pelo menos 10 transações
- ✅ Importa no sistema corretamente
- ✅ Teste de conexão funciona
- ✅ Trata erros graciosamente
- ✅ Não quebra com mudanças menores na interface

---

## 🎯 Próxima Ação Imediata

**Implementar login básico do Itaú** para poder testar o fluxo completo.

