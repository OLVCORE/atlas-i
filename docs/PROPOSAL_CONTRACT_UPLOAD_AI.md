# Proposta: Upload e Análise de Contratos com IA

## Objetivo

Permitir que o usuário faça upload de um PDF de contrato e use IA para extrair automaticamente todas as informações relevantes, preenchendo automaticamente o formulário de criação/edição de contrato.

## Funcionalidades Desejadas

Ao criar/editar um contrato, o usuário poderá:

1. **Upload de PDF**: Fazer upload de um arquivo PDF do contrato
2. **Análise Automática**: A IA analisa o documento e extrai:
   - **Partes do Contrato:**
     - Contratante (cliente) - nome, CNPJ
     - Contratado (prestador) - nome, CNPJ
   - **Valores:**
     - Valor total do contrato
     - Valor mensal (se aplicável)
     - Tipo de valor (total, mensal, anual)
   - **Datas:**
     - Data de início
     - Data de término
     - Data de assinatura
   - **Índices de Reajuste:**
     - Tipo de índice (IPCA, IGPM, CDI, etc.)
     - Periodicidade do reajuste
     - Percentual (se especificado)
   - **Outros Detalhes:**
     - Descrição do contrato
     - Objeto do contrato
     - Condições especiais

3. **Revisão e Ajuste**: O usuário pode revisar os dados extraídos e ajustar antes de salvar

## Arquitetura Proposta

### 1. Backend: API Route para Upload e Análise

```
app/api/contracts/analyze/route.ts
```

**Fluxo:**
1. Recebe o arquivo PDF via upload
2. Converte PDF para texto (usando `pdf-parse` ou similar)
3. Envia texto para IA (OpenAI GPT-4 ou Claude)
4. IA extrai informações estruturadas
5. Retorna JSON com dados extraídos

### 2. Modelo de Dados

O contrato já possui os campos necessários:
- `counterparty_entity_id` - ID da entidade contratante
- `title` - Título do contrato
- `description` - Descrição
- `total_value` - Valor total
- `monthly_value` - Valor mensal
- `value_type` - Tipo de valor (total, monthly, etc.)
- `start_date` - Data de início
- `end_date` - Data de término
- `adjustment_index` - Índice de reajuste
- `adjustment_frequency` - Periodicidade
- `adjustment_percentage` - Percentual

### 3. Integração com IA

#### Opção A: OpenAI GPT-4 (Recomendado)

```typescript
// lib/ai/contract-extractor.ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function extractContractData(pdfText: string) {
  const prompt = `
    Analise o seguinte contrato e extraia as informações em formato JSON:
    
    ${pdfText}
    
    Extraia:
    - contratante_nome, contratante_cnpj
    - contratado_nome, contratado_cnpj
    - valor_total, valor_mensal, tipo_valor
    - data_inicio, data_termino
    - indice_reajuste, periodicidade_reajuste, percentual_reajuste
    - descricao, objeto
    
    Retorne JSON válido.
  `
  
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  })
  
  return JSON.parse(response.choices[0].message.content)
}
```

#### Opção B: Claude (Anthropic)

Similar ao OpenAI, mas usando a API do Claude.

#### Opção C: Gemini (Google)

Usando Google Gemini API.

### 4. Frontend: Componente de Upload

```typescript
// components/contracts/contract-ai-upload.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Loader2 } from "lucide-react"

export function ContractAIUpload({
  onDataExtracted,
}: {
  onDataExtracted: (data: ExtractedContractData) => void
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const handleFileUpload = async (file: File) => {
    // Upload e análise
  }
  
  return (
    <div>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => handleFileUpload(e.target.files[0])}
      />
      {/* UI de upload e progresso */}
    </div>
  )
}
```

### 5. Integração no Formulário de Contrato

Adicionar botão "Analisar PDF" no formulário de criação/edição:

```typescript
// components/contract-form-client.tsx
<ContractAIUpload
  onDataExtracted={(data) => {
    // Preencher campos do formulário com dados extraídos
    setFormData(data)
  }}
/>
```

## Fluxo Completo

1. **Usuário clica em "Criar Contrato"**
2. **Formulário de contrato abre**
3. **Usuário clica em "Analisar PDF do Contrato"**
4. **Dialog de upload abre**
5. **Usuário seleciona arquivo PDF**
6. **Sistema faz upload e converte PDF para texto**
7. **Texto é enviado para IA (com loading/spinner)**
8. **IA retorna dados estruturados**
9. **Formulário é preenchido automaticamente**
10. **Usuário revisa e ajusta dados**
11. **Usuário salva contrato**

## Bibliotecas Necessárias

### Backend
- `pdf-parse` ou `pdf.js` - Extração de texto do PDF
- `openai` - Integração com OpenAI (ou equivalente para Claude/Gemini)
- `multer` ou `formidable` - Upload de arquivos (já existe no Next.js)

### Frontend
- Componentes UI já existentes
- Estados React para gerenciar upload/análise

## Segurança e Privacidade

1. **Validação de arquivo**: Apenas PDFs, limite de tamanho (ex: 10MB)
2. **Armazenamento temporário**: Arquivos são processados e deletados após análise
3. **Dados sensíveis**: PDFs não são armazenados permanentemente (apenas dados extraídos)
4. **Rate limiting**: Limitar número de análises por usuário/tempo

## Custos Estimados

- **OpenAI GPT-4 Turbo**: ~$0.01-0.03 por análise (dependendo do tamanho do PDF)
- **Armazenamento temporário**: Negligível
- **Processamento**: Negligível

## Fases de Implementação

### Fase 1: MVP (Mínimo Viável)
- Upload de PDF
- Extração de texto básica
- Análise com IA (campos principais)
- Preenchimento automático do formulário

### Fase 2: Melhorias
- Validação de dados extraídos
- Sugestões de correção
- Suporte a múltiplos formatos (PDF escaneado com OCR)

### Fase 3: Avançado
- Reconhecimento de cláusulas especiais
- Alertas para condições incomuns
- Histórico de análises
- Aprendizado com feedback do usuário

## Próximos Passos

1. ✅ Criar API route `/api/contracts/analyze`
2. ✅ Implementar extração de texto do PDF
3. ✅ Integrar com OpenAI (ou alternativa)
4. ✅ Criar componente de upload no frontend
5. ✅ Integrar com formulário de contrato
6. ✅ Testes e validações

## Alternativas Mais Simples (Sem IA)

Se o custo da IA for proibitivo, podemos:

1. **Template de formulário estruturado**: Usuário preenche manualmente baseado no PDF
2. **Upload de PDF + armazenamento**: Apenas armazenar PDF para referência futura
3. **Assistente de preenchimento**: IA leve que sugere campos baseado em palavras-chave (mais barato)

## Decisão Recomendada

**Implementar Fase 1 (MVP) com OpenAI GPT-4 Turbo** por:
- Melhor experiência do usuário
- Redução significativa de erros de digitação
- Economia de tempo
- Custo razoável por análise (~$0.01-0.03)
