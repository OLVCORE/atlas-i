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
    PluggyConnect?: new (options: {
      connectToken: string
      onSuccess: (payload: any) => void
      onError: (error: any) => void
      onClose?: () => void
    }) => {
      open?: () => void
      init?: () => void
      destroy?: () => void
      close?: () => void
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
  const widgetRef = useRef<any>(null)

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

  useEffect(() => {
    return () => {
      if (widgetRef.current) {
        if (typeof widgetRef.current.destroy === 'function') {
          widgetRef.current.destroy()
        } else if (typeof widgetRef.current.close === 'function') {
          widgetRef.current.close()
        }
        widgetRef.current = null
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
        const errorText = await tokenResponse.text().catch(() => "Erro desconhecido")
        let errorMessage = `Erro ao obter connect token (${tokenResponse.status})`
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorData.message || errorMessage
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`
          }
        } catch {
          if (errorText) {
            errorMessage += `: ${errorText.substring(0, 200)}`
          }
        }
        throw new Error(errorMessage)
      }

      const { connectToken } = await tokenResponse.json()
      if (!connectToken) {
        throw new Error("Connect token não retornado")
      }

      const PluggyConnectCtor = window.PluggyConnect
      if (!PluggyConnectCtor) {
        throw new Error("PluggyConnect não está disponível")
      }

      const widget = new PluggyConnectCtor({
        connectToken,
        onSuccess: async (payload: any) => {
          const itemId = payload?.itemId || payload?.item?.id

          if (!itemId) {
            const error = new Error("itemId não retornado pelo widget")
            onError?.(error)
            setLoading(false)
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
              const errorText = await response.text().catch(() => "Erro desconhecido")
              let errorMessage = `Erro ao salvar conexão (${response.status})`
              try {
                const errorData = JSON.parse(errorText)
                errorMessage = errorData.error || errorData.message || errorMessage
                if (errorData.details) {
                  errorMessage += `: ${errorData.details}`
                }
              } catch {
                if (errorText) {
                  errorMessage += `: ${errorText.substring(0, 200)}`
                }
              }
              throw new Error(errorMessage)
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
        onClose: () => {
          setLoading(false)
        },
      })

      widgetRef.current = widget

      if (typeof widget.open === 'function') {
        widget.open()
      } else if (typeof widget.init === 'function') {
        widget.init()
      } else {
        throw new Error("Widget não possui método open() ou init()")
      }
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

