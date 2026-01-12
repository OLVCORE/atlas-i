"use client"

import { Button } from "@/components/ui/button"
import { Printer, Download, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef } from "react"

interface DebitNotePreviewProps {
  debitNote: any
  contract: any
  entity: any
}

export default function DebitNotePreview({
  debitNote,
  contract,
  entity,
}: DebitNotePreviewProps) {
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/debit-notes/${debitNote.id}/pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `nota-debito-${debitNote.number}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // Se a geração de PDF falhar, usar impressão como fallback
        alert("Geração automática de PDF não disponível. Use a opção de Imprimir para salvar como PDF.")
        window.print()
      }
    } catch (error) {
      console.error("Erro ao baixar PDF:", error)
      alert("Erro ao gerar PDF. Use a opção de Imprimir para salvar como PDF.")
      window.print()
    }
  }

  // Ordenar itens por item_order
  const sortedItems = [...debitNote.items].sort(
    (a: any, b: any) => (a.item_order || 0) - (b.item_order || 0)
  )

  // Separar itens por tipo
  const scheduleItems = sortedItems.filter(
    (item: any) => item.contract_schedule_id !== null
  )
  const expenseItems = sortedItems.filter((item: any) => item.type === "expense")
  const discountItems = sortedItems.filter((item: any) => item.type === "discount")

  // Calcular subtotais
  const schedulesSubtotal = scheduleItems.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  )
  const expensesSubtotal = expenseItems.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  )
  const discountsSubtotal = discountItems.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de ações (não aparece na impressão) */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Salvar como PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo da nota (aparece na impressão) */}
      <div ref={printRef} className="max-w-4xl mx-auto bg-white p-8 print:p-4">
        <div className="border-b-2 border-gray-800 pb-6 mb-8">
          <h1 className="text-3xl font-bold mb-2">NOTA DE DÉBITO</h1>
          <div className="text-sm text-gray-600">Número: {debitNote.number}</div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between">
            <span className="font-semibold">Cliente:</span>
            <span>{entity.legal_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Documento:</span>
            <span>{entity.document}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Contrato:</span>
            <span>{contract.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Data de Emissão:</span>
            <span>{formatDate(debitNote.issued_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Data de Vencimento:</span>
            <span>{formatDate(debitNote.due_date)}</span>
          </div>
          {debitNote.description && (
            <div className="flex justify-between">
              <span className="font-semibold">Descrição:</span>
              <span>{debitNote.description}</span>
            </div>
          )}
        </div>

        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-b-2 border-gray-800 p-3 text-left font-bold">
                Descrição
              </th>
              <th className="border-b-2 border-gray-800 p-3 text-right font-bold">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Itens dos schedules */}
            {scheduleItems.map((item: any, index: number) => (
              <tr key={`schedule-${index}`} className="border-b border-gray-200">
                <td className="p-3">{item.description || "-"}</td>
                <td className="p-3 text-right">{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Despesas adicionais */}
            {expenseItems.map((item: any, index: number) => (
              <tr key={`expense-${index}`} className="border-b border-gray-200">
                <td className="p-3">{item.description || "Despesa adicional"}</td>
                <td className="p-3 text-right">{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Descontos */}
            {discountItems.map((item: any, index: number) => (
              <tr key={`discount-${index}`} className="border-b border-gray-200">
                <td className="p-3">{item.description || "Desconto"}</td>
                <td className="p-3 text-right">{formatCurrency(-item.amount)}</td>
              </tr>
            ))}

            {/* Subtotais */}
            {(expenseItems.length > 0 || discountItems.length > 0) && (
              <>
                <tr className="bg-gray-50">
                  <td className="p-3 font-semibold border-t border-gray-300">
                    Subtotal (Schedules)
                  </td>
                  <td className="p-3 text-right font-semibold border-t border-gray-300">
                    {formatCurrency(schedulesSubtotal)}
                  </td>
                </tr>
                {expenseItems.length > 0 && (
                  <tr className="bg-gray-50">
                    <td className="p-3 font-semibold">Subtotal (Despesas)</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(expensesSubtotal)}
                    </td>
                  </tr>
                )}
                {discountItems.length > 0 && (
                  <tr className="bg-gray-50">
                    <td className="p-3 font-semibold">Subtotal (Descontos)</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(-discountsSubtotal)}
                    </td>
                  </tr>
                )}
              </>
            )}

            {/* Total */}
            <tr className="bg-gray-200 font-bold text-lg">
              <td className="p-4 border-t-2 border-gray-800">TOTAL</td>
              <td className="p-4 text-right border-t-2 border-gray-800">
                {formatCurrency(debitNote.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 pt-6 border-t border-gray-300 text-xs text-gray-600 text-center">
          <p>Esta nota de débito foi gerada automaticamente pelo sistema ATLAS-i</p>
          <p className="mt-1">
            Data de geração: {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Estilos para impressão */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 20mm 15mm;
          }
          
          body {
            background: white;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:p-4 {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
