"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type PluggyConnectButtonProps = {
  disabled?: boolean
  entityId?: string
  onSuccess?: (itemId: string) => void
  onError?: (error: Error) => void
}

declare global {
  interface Window {
    PluggyConnect?: (options: {
      connectToken: string
      onSuccess: (payload: any) => void
      onError: (error: any) => void
    }) => {
      init: () => void
    }
  }
}

export function PluggyConnectButton({
  disabled = false,
  entityId,
  onSuccess,
  onError,
}: PluggyConnectButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const scriptLoadedRef = useRef(false)
  const scriptLoadingRef = useRef(false)

  useEffect(() => {
    if (scriptLoadedRef.current || scriptLoadingRef.current) {
      return
    }

    if (typeof window === "undefined") {
      return
    }

    if (window.PluggyConnect) {
      scriptLoadedRef.current = true
      return
    }

    scriptLoadingRef.current = true

    const script = document.createElement("script")
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js"
    script.async = true
    script.onload = () => {
      scriptLoadedRef.current = true
      scriptLoadingRef.current = false
    }
    script.onerror = () => {
      scriptLoadingRef.current = false
      console.error("[PluggyConnect] Failed to load script")
    }

    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const handleClick = async () => {
    if (loading || disabled) {
      return
    }

    setLoading(true)

    try {
      if (typeof window === "undefined") {
        throw new Error("Widget deve ser aberto apenas no client")
      }

      let attempts = 0
      const maxAttempts = 60
      while (!window.PluggyConnect && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }

      if (!window.PluggyConnect) {
        throw new Error(
          "Pluggy Connect não carregou. Recarregue a página e tente novamente."
        )
      }

      const tokenResponse = await fetch("/api/pluggy/connect-token")
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}))
        throw new Error(errorData.error || "Erro ao obter connect token")
      }

      const { connectToken } = await tokenResponse.json()
      if (!connectToken) {
        throw new Error("Connect token não retornado")
      }

      const PluggyConnect = window.PluggyConnect
      const widget = PluggyConnect({
        connectToken,
        onSuccess: async (payload: any) => {
          const itemId = payload?.itemId || payload?.item?.id

          if (!itemId) {
            const error = new Error("itemId não retornado pelo widget")
            onError?.(error)
            return
          }

          try {
            const response = await fetch("/api/connections", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                providerKey: "pluggy",
                externalConnectionId: itemId,
                entityId,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || "Erro ao salvar conexão")
            }

            onSuccess?.(itemId)
            router.refresh()
          } catch (error) {
            console.error("Erro ao salvar conexão:", error)
            onError?.(error instanceof Error ? error : new Error("Erro desconhecido"))
          } finally {
            setLoading(false)
          }
        },
        onError: (error: any) => {
          console.error("Erro no widget Pluggy:", error)
          const err = error instanceof Error ? error : new Error(error?.message || "Erro ao conectar via Pluggy")
          onError?.(err)
          setLoading(false)
        },
      })

      widget.init()
    } catch (error) {
      console.error("Erro ao abrir widget Pluggy:", error)
      const err = error instanceof Error ? error : new Error("Erro desconhecido")
      onError?.(err)
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={disabled || loading}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Conectando...
        </>
      ) : (
        "Conectar via Pluggy"
      )}
    </Button>
  )
}

