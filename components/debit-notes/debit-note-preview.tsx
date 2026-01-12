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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Barra de ações (não aparece na impressão) */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b shadow-sm print:hidden">
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
      <div ref={printRef} className="max-w-4xl mx-auto bg-white dark:bg-white p-8 print:p-4 print:bg-white">
        <div className="border-b-2 border-gray-800 pb-6 mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 print:text-black">NOTA DE DÉBITO</h1>
          <div className="text-sm text-gray-600 print:text-gray-700">Número: {debitNote.number}</div>
        </div>

        <div className="space-y-4 mb-8 text-gray-900 print:text-black">
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

        <table className="w-full border-collapse mb-6 text-gray-900 print:text-black">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-100">
              <th className="border-b-2 border-gray-800 p-3 text-left font-bold text-gray-900 print:text-black">
                Descrição
              </th>
              <th className="border-b-2 border-gray-800 p-3 text-right font-bold text-gray-900 print:text-black">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Itens dos schedules */}
            {scheduleItems.length > 0 && scheduleItems.map((item: any, index: number) => (
              <tr key={`schedule-${index}`} className="border-b border-gray-200 print:border-gray-300">
                <td className="p-3 text-gray-900 print:text-black">{item.description || "-"}</td>
                <td className="p-3 text-right text-gray-900 print:text-black">{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Despesas adicionais */}
            {expenseItems.length > 0 && expenseItems.map((item: any, index: number) => (
              <tr key={`expense-${index}`} className="border-b border-gray-200 print:border-gray-300">
                <td className="p-3 text-gray-900 print:text-black">{item.description || "Despesa adicional"}</td>
                <td className="p-3 text-right text-gray-900 print:text-black">{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Descontos */}
            {discountItems.length > 0 && discountItems.map((item: any, index: number) => (
              <tr key={`discount-${index}`} className="border-b border-gray-200 print:border-gray-300">
                <td className="p-3 text-gray-900 print:text-black">{item.description || "Desconto"}</td>
                <td className="p-3 text-right text-gray-900 print:text-black">{formatCurrency(-item.amount)}</td>
              </tr>
            ))}

            {/* Subtotais */}
            {(expenseItems.length > 0 || discountItems.length > 0) && (
              <>
                {scheduleItems.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-50">
                    <td className="p-3 font-semibold border-t border-gray-300 text-gray-900 print:text-black">
                      Subtotal (Schedules)
                    </td>
                    <td className="p-3 text-right font-semibold border-t border-gray-300 text-gray-900 print:text-black">
                      {formatCurrency(schedulesSubtotal)}
                    </td>
                  </tr>
                )}
                {expenseItems.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-900 print:text-black">Subtotal (Despesas)</td>
                    <td className="p-3 text-right font-semibold text-gray-900 print:text-black">
                      {formatCurrency(expensesSubtotal)}
                    </td>
                  </tr>
                )}
                {discountItems.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-50">
                    <td className="p-3 font-semibold text-gray-900 print:text-black">Subtotal (Descontos)</td>
                    <td className="p-3 text-right font-semibold text-gray-900 print:text-black">
                      {formatCurrency(-discountsSubtotal)}
                    </td>
                  </tr>
                )}
              </>
            )}

            {/* Total */}
            <tr className="bg-gray-200 print:bg-gray-200 font-bold text-lg">
              <td className="p-4 border-t-2 border-gray-800 text-gray-900 print:text-black">TOTAL</td>
              <td className="p-4 text-right border-t-2 border-gray-800 text-gray-900 print:text-black">
                {formatCurrency(debitNote.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Observações */}
        {debitNote.notes && (
          <div className="mt-8 pt-6 border-t border-gray-300">
            <h3 className="font-semibold mb-2 text-gray-900 print:text-black">Observações:</h3>
            <div className="text-sm text-gray-700 print:text-black whitespace-pre-line">
              {debitNote.notes}
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-300 text-xs text-gray-600 print:text-gray-700 text-center">
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
            size: A4;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            background: white !important;
            color: black !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:p-4 {
            padding: 1rem;
          }
          
          .print\\:bg-white {
            background: white !important;
          }
          
          .print\\:text-black {
            color: black !important;
          }
          
          /* Garantir que todos os itens apareçam na impressão */
          table tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Garantir que cores de fundo apareçam */
          .bg-gray-50,
          .bg-gray-100,
          .bg-gray-200 {
            background-color: #f9fafb !important;
          }
          
          /* Garantir bordas visíveis */
          .border-gray-200,
          .border-gray-300,
          .border-gray-800 {
            border-color: #374151 !important;
          }
        }
      `}</style>
    </div>
  )
}
