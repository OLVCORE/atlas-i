import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { gatherAssistantContext } from "@/lib/assistant/context"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"

// Rate limiting simples (em memória, reset a cada hora)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hora
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requisições por hora por usuário

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  userLimit.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Validar API key ANTES de processar qualquer coisa
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Assistente indisponível: ambiente não configurado." },
        { status: 503 }
      )
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Limite de uso atingido. Tente novamente mais tarde." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { message, contextHint } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 })
    }

    // Sanitização: remover quebras gigantes e caracteres suspeitos
    const sanitizedMessage = message
      .replace(/\n{10,}/g, "\n\n") // Limitar múltiplas quebras de linha
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "") // Remover caracteres de controle
      .trim()
      .slice(0, 1000) // Limitar tamanho

    if (sanitizedMessage.length === 0) {
      return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 })
    }

    // Coletar contexto do workspace
    const context = await gatherAssistantContext()

    // Montar prompt
    const systemPrompt = `Você é o ATLAS Guide, assistente virtual do sistema financeiro ATLAS-i. Suas regras absolutas:

1. NUNCA crie, edite ou delete dados. Você apenas ORIENTA e EXPLICA.
2. NUNCA invente valores ou dados. Use apenas o contexto fornecido.
3. Responda sempre em português brasileiro, de forma corporativa, curta e objetiva.
4. Explique conceitos, regras e funcionalidades quando solicitado.
5. Sugira próximos passos baseado no estado atual do workspace.

Contexto do workspace "${context.workspace.name}":
- ${context.counts.entities} entidade(s)
- ${context.counts.accounts} conta(s)
- ${context.counts.cards} cartão(ões)
- ${context.counts.transactions} transação(ões)
- ${context.counts.providers} provider(s) configurado(s)
- ${context.counts.connections} conexão(ões)

${context.recentTransactions.length > 0 ? `Últimas transações:\n${context.recentTransactions.slice(0, 5).map((t) => `- ${t.description} (${t.date}): R$ ${t.amount.toFixed(2)}`).join("\n")}` : "Nenhuma transação registrada ainda."}

${context.providers.length > 0 ? `Providers: ${context.providers.map((p) => `${p.name} (${p.status})`).join(", ")}` : ""}

Responda de forma útil, mas sempre respeitando as regras acima.`

    // Chamar OpenAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sanitizedMessage },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!openaiResponse.ok) {
      // Em desenvolvimento, logar o status para debug
      if (process.env.NODE_ENV === "development") {
        const errorText = await openaiResponse.text()
        console.error("OpenAI API error:", openaiResponse.status, errorText.substring(0, 200))
      }
      // Não expor detalhes do erro em produção
      return NextResponse.json(
        { error: "Falha ao processar solicitação." },
        { status: 500 }
      )
    }

    const data = await openaiResponse.json()
    const answer = data.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação."

    // Gerar citações baseadas no contexto usado
    const citations: string[] = []
    if (context.counts.entities > 0) {
      citations.push(`${context.counts.entities} entidade(s)`)
    }
    if (context.counts.cards > 0) {
      citations.push(`${context.counts.cards} cartão(ões)`)
    }
    if (context.recentTransactions.length > 0) {
      citations.push(`${context.recentTransactions.length} transação(ões) recente(s)`)
    }

    return NextResponse.json({
      answer,
      citations: citations.length > 0 ? citations : undefined,
    })
  } catch (error: any) {
    // Log detalhado apenas em desenvolvimento
    if (process.env.NODE_ENV === "development") {
      console.error("Erro no assistente:", error)
    }
    // Não expor detalhes do erro (stack trace, mensagens internas)
    return NextResponse.json(
      { error: "Falha ao processar solicitação." },
      { status: 500 }
    )
  }
}

