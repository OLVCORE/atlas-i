"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, ArrowLeft } from "lucide-react"
import { HelpTooltip } from "@/components/help/HelpTooltip"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const router = useRouter()

  // Verificar variáveis de ambiente apenas no cliente
  const [hasEnv, setHasEnv] = useState<boolean | null>(null)

  // Criar cliente apenas no cliente, após mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      setHasEnv(!!url && !!key)
      if (url && key) {
        setSupabase(createClient())
      }
    }
  }, [])

  const getErrorMessage = (error: any): string => {
    if (!error) return "Erro desconhecido"
    
    const status = error.status || error.code
    const message = error.message || error.toString() || ""
    const lowerMessage = message.toLowerCase()
    
    if (status === 429 || lowerMessage.includes("429") || lowerMessage.includes("rate limit")) {
      return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente"
    }
    
    if (lowerMessage.includes("user not found") || lowerMessage.includes("email not found")) {
      // Não revelar que o email não existe (segurança)
      return "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha"
    }
    
    return message || "Erro ao processar solicitação. Tente novamente"
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    if (!email) {
      setError("Preencha o e-mail")
      setLoading(false)
      return
    }

    if (!supabase) {
      setError("Cliente não inicializado. Recarregue a página.")
      setLoading(false)
      return
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        // Mesmo em caso de erro, mostrar mensagem genérica (não revelar se email existe)
        setError(getErrorMessage(resetError))
      } else {
        // Sempre mostrar mensagem de sucesso (mesmo se email não existir, por segurança)
        setSuccessMessage("Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada e a pasta de spam.")
      }
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (hasEnv === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Configuração ausente</h1>
          <p className="text-muted-foreground">
            Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local
          </p>
        </div>
      </div>
    )
  }

  if (!supabase || hasEnv === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground">
            Digite seu e-mail e enviaremos um link para redefinir sua senha
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="email">E-mail</Label>
              <HelpTooltip contentKey="login.email" />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="pl-10"
              />
            </div>
          </div>

          {successMessage && (
            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-600 dark:text-green-400">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de redefinição"}
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

