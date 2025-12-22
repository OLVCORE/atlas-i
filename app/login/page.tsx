"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Eye, EyeOff } from "lucide-react"
import { HelpTooltip } from "@/components/help/HelpTooltip"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [useMagicLink, setUseMagicLink] = useState(true)
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
    
    if (status === 400 || status === "400") {
      if (lowerMessage.includes("invalid") || lowerMessage.includes("credentials")) {
        return "E-mail ou senha inválidos"
      }
      return "Dados inválidos. Verifique e-mail e senha"
    }
    
    if (lowerMessage.includes("invalid login credentials") || lowerMessage.includes("invalid credentials")) {
      return "E-mail ou senha inválidos"
    }
    if (lowerMessage.includes("user already registered") || lowerMessage.includes("already registered")) {
      return "Este e-mail já está cadastrado. Use o Magic Link para fazer login"
    }
    if (lowerMessage.includes("password should be at least") || lowerMessage.includes("password")) {
      return "A senha deve ter pelo menos 6 caracteres"
    }
    if (status === 429 || lowerMessage.includes("429") || lowerMessage.includes("rate limit")) {
      return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente"
    }
    
    return message || "Erro ao processar solicitação. Tente novamente"
  }

  const handleMagicLink = async (e: React.FormEvent) => {
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
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
        },
      })

      if (magicLinkError) {
        setError(getErrorMessage(magicLinkError))
      } else {
        setSuccessMessage("Link de acesso enviado por e-mail! Verifique sua caixa de entrada.")
      }
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    if (!email || !password) {
      setError("Preencha e-mail e senha")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      setLoading(false)
      return
    }

    if (!supabase) {
      setError("Cliente não inicializado. Recarregue a página.")
      setLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(getErrorMessage(signInError))
        return
      }

      if (data.user) {
        router.push("/app")
        router.refresh()
      }
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    if (!email || !password) {
      setError("Preencha e-mail e senha")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      setLoading(false)
      return
    }

    if (!supabase) {
      setError("Cliente não inicializado. Recarregue a página.")
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (signUpError) {
        setError(getErrorMessage(signUpError))
        return
      }

      if (data.user && data.session) {
        router.push("/app")
        router.refresh()
      } else {
        setSuccessMessage("Conta criada. Use o Magic Link para fazer login.")
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
          <h1 className="text-2xl font-semibold">ATLAS-i</h1>
          <p className="text-sm text-muted-foreground">
            Faça login para acessar seu workspace
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-4">
            <Button
              type="button"
              variant={useMagicLink ? "default" : "ghost"}
              size="sm"
              onClick={() => setUseMagicLink(true)}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              Magic Link
              <span className="ml-2">
                <HelpTooltip contentKey="login.magic_link" />
              </span>
            </Button>
            <Button
              type="button"
              variant={!useMagicLink ? "default" : "ghost"}
              size="sm"
              onClick={() => setUseMagicLink(false)}
              className="flex-1"
            >
              Senha
            </Button>
          </div>

          {useMagicLink ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <HelpTooltip contentKey="login.email" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              {successMessage && (
                <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400">
                  {successMessage}
                </div>
              )}
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Link de Acesso"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Enviaremos um link de acesso para seu e-mail. Clique no link para entrar.
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email-password">E-mail</Label>
                  <HelpTooltip contentKey="login.email" />
                </div>
                <Input
                  id="email-password"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="password">Senha</Label>
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
                    autoComplete="current-password"
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
              </div>
              {successMessage && (
                <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400">
                  <div className="flex items-start gap-2">
                    <HelpTooltip contentKey="login.confirmation" />
                    <span>{successMessage}</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSignUp}
                  disabled={loading}
                >
                  Criar conta
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
