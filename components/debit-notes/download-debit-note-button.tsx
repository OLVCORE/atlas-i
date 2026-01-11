"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

type DownloadDebitNoteButtonProps = {
  debitNoteId: string
}

export function DownloadDebitNoteButton({ debitNoteId }: DownloadDebitNoteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/debit-notes/${debitNoteId}/pdf`)
      if (!response.ok) {
        throw new Error("Erro ao gerar PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `nota-debito-${debitNoteId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Erro ao baixar PDF:", err)
      alert("Erro ao gerar PDF. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading}>
      <Download className="h-4 w-4 mr-2" />
      {isLoading ? "Gerando..." : "PDF"}
    </Button>
  )
}
