"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react"
import { HelpTooltip } from "@/components/help/HelpTooltip"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

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
    
    const message = error.message || error.toString() || ""
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes("password should be at least") || lowerMessage.includes("password")) {
      return "A senha deve ter pelo menos 6 caracteres"
    }
    
    if (lowerMessage.includes("token") || lowerMessage.includes("expired") || lowerMessage.includes("invalid")) {
      return "Link inválido ou expirado. Solicite um novo link de redefinição de senha"
    }
    
    return message || "Erro ao processar solicitação. Tente novamente"
  }

  const validatePassword = (): string | null => {
    if (!password) {
      return "A senha é obrigatória"
    }
    
    if (password.length < 6) {
      return "A senha deve ter pelo menos 6 caracteres"
    }
    
    if (password !== confirmPassword) {
      return "As senhas não coincidem"
    }
    
    return null
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    const validationError = validatePassword()
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    if (!supabase) {
      setError("Cliente não inicializado. Recarregue a página.")
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        setError(getErrorMessage(updateError))
      } else {
        setSuccessMessage("Senha redefinida com sucesso! Redirecionando para o login...")
        
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          router.push("/login")
        }, 2000)
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
          <h1 className="text-2xl font-semibold">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">
            Digite sua nova senha
          </p>
        </div>

        {successMessage && (
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-600 dark:text-green-400">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {error && !successMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!successMessage && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="password">Nova senha</Label>
                <HelpTooltip contentKey="login.password" />
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo de 6 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Redefinindo..." : "Redefinir senha"}
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
        )}
      </div>
    </div>
  )
}

