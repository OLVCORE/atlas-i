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
    (sum, item) => sum + Math.abs(Number(item.amount)),
    0
  )
  // Descontos são sempre valores positivos no banco, mas devem ser subtraídos
  const discountsSubtotal = discountItems.reduce(
    (sum, item) => sum + Math.abs(Number(item.amount)),
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

      {/* Conteúdo da nota (aparece na impressão) - Design Profissional e Compacto */}
      <div ref={printRef} className="max-w-4xl mx-auto bg-white dark:bg-white p-6 print:p-3 print:bg-white print:text-xs">
        {/* Cabeçalho Compacto */}
        <div className="border-b-2 border-gray-900 pb-3 mb-4 print:pb-2 print:mb-2">
          <div className="flex justify-between items-start mb-1">
            <div>
              <h1 className="text-2xl print:text-xl font-bold text-gray-900 print:text-black mb-0.5">NOTA DE DÉBITO</h1>
              <div className="text-xs print:text-[10px] text-gray-600 print:text-gray-700 font-medium">Número: {debitNote.number}</div>
            </div>
            <div className="text-right text-xs print:text-[10px] text-gray-600 print:text-gray-700">
              <div>Data de Emissão: {formatDate(debitNote.issued_date)}</div>
              <div>Vencimento: {formatDate(debitNote.due_date)}</div>
            </div>
          </div>
        </div>

        {/* Informações do Cliente - Layout Compacto em 2 Colunas */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 print:mb-3 text-xs print:text-[10px] text-gray-900 print:text-black">
          <div>
            <span className="font-semibold">Entidade:</span> {entity.legal_name}
          </div>
          <div>
            <span className="font-semibold">Documento:</span> {entity.document}
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Cliente:</span> {debitNote.client_name || entity.legal_name}
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Contrato:</span> {contract.title}
          </div>
          {debitNote.description && (
            <div className="col-span-2">
              <span className="font-semibold">Descrição:</span> {debitNote.description}
            </div>
          )}
        </div>

        {/* Tabela de Itens - Design Profissional e Compacto */}
        <table className="w-full border-collapse mb-4 print:mb-2 text-xs print:text-[10px] text-gray-900 print:text-black">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-100 border-b-2 border-gray-900">
              <th className="p-2 print:p-1 text-left font-bold text-gray-900 print:text-black border-r border-gray-300">
                Descrição
              </th>
              <th className="p-2 print:p-1 text-right font-bold text-gray-900 print:text-black w-24">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Itens dos schedules */}
            {scheduleItems.length > 0 && scheduleItems.map((item: any, index: number) => (
              <tr key={`schedule-${index}`} className="border-b border-gray-200 print:border-gray-300">
                <td className="p-2 print:p-1 text-gray-900 print:text-black border-r border-gray-200">{item.description || "-"}</td>
                <td className="p-2 print:p-1 text-right text-gray-900 print:text-black font-medium">{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Despesas adicionais */}
            {expenseItems.length > 0 && expenseItems.map((item: any, index: number) => (
              <tr key={`expense-${index}`} className="border-b border-gray-200 print:border-gray-300">
                <td className="p-2 print:p-1 text-gray-900 print:text-black border-r border-gray-200">{item.description || "Despesa adicional"}</td>
                <td className="p-2 print:p-1 text-right text-gray-900 print:text-black font-medium">{formatCurrency(item.amount)}</td>
              </tr>
            ))}

            {/* Descontos */}
            {discountItems.length > 0 && discountItems.map((item: any, index: number) => (
              <tr key={`discount-${index}`} className="border-b border-gray-200 print:border-gray-300">
                <td className="p-2 print:p-1 text-gray-900 print:text-black border-r border-gray-200">{item.description || "Desconto"}</td>
                <td className="p-2 print:p-1 text-right text-gray-900 print:text-black font-medium text-red-600 print:text-red-700">
                  {formatCurrency(-item.amount)}
                </td>
              </tr>
            ))}

            {/* Subtotais conforme solicitado */}
            {(expenseItems.length > 0 || discountItems.length > 0) && (
              <>
                {/* Subtotal 1: Schedules + Despesas */}
                <tr className="bg-gray-50 print:bg-gray-50 border-t-2 border-gray-400">
                  <td className="p-2 print:p-1 font-semibold text-gray-900 print:text-black border-r border-gray-200">
                    Subtotal (Schedules + Despesas)
                  </td>
                  <td className="p-2 print:p-1 text-right font-semibold text-gray-900 print:text-black">
                    {formatCurrency(subtotal1)}
                  </td>
                </tr>
                {/* Subtotal 2: Descontos/Créditos/Isenções */}
                {discountItems.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-50">
                    <td className="p-2 print:p-1 font-semibold text-gray-900 print:text-black border-r border-gray-200">
                      Subtotal (Descontos / Créditos / Isenções)
                    </td>
                    <td className="p-2 print:p-1 text-right font-semibold text-gray-900 print:text-black text-red-600 print:text-red-700">
                      {formatCurrency(-discountsSubtotal)}
                    </td>
                  </tr>
                )}
              </>
            )}

            {/* Total */}
            <tr className="bg-gray-200 print:bg-gray-200 font-bold border-t-2 border-gray-900">
              <td className="p-2 print:p-1 text-gray-900 print:text-black border-r border-gray-300">TOTAL</td>
              <td className="p-2 print:p-1 text-right text-gray-900 print:text-black text-lg print:text-base">
                {formatCurrency(debitNote.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Observações */}
        {debitNote.notes && (
          <div className="mt-3 print:mt-2 pt-2 print:pt-1 border-t border-gray-300">
            <h3 className="font-semibold mb-1 print:mb-0.5 text-xs print:text-[10px] text-gray-900 print:text-black">Observações:</h3>
            <div className="text-xs print:text-[10px] text-gray-700 print:text-black whitespace-pre-line leading-tight">
              {debitNote.notes}
            </div>
          </div>
        )}

        {/* Rodapé Compacto */}
        <div className="mt-4 print:mt-2 pt-2 print:pt-1 border-t border-gray-300 text-[10px] print:text-[9px] text-gray-600 print:text-gray-700 text-center">
          <p>Esta nota de débito foi gerada automaticamente pelo sistema ATLAS-i</p>
          <p className="mt-0.5">Data de geração: {new Date().toLocaleString("pt-BR")}</p>
        </div>
      </div>

      {/* Estilos para impressão otimizada - Uma única página */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 8mm 6mm;
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
            font-size: 10px !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:p-3 {
            padding: 0.75rem !important;
          }
          
          .print\\:bg-white {
            background: white !important;
          }
          
          .print\\:text-black {
            color: black !important;
          }
          
          .print\\:text-\\[10px\\] {
            font-size: 10px !important;
          }
          
          .print\\:text-\\[9px\\] {
            font-size: 9px !important;
          }
          
          /* Garantir que todos os itens apareçam na impressão */
          table tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Evitar quebra de página dentro da tabela */
          table {
            page-break-inside: avoid;
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
          .border-gray-800,
          .border-gray-900 {
            border-color: #374151 !important;
          }
          
          /* Reduzir espaçamentos para caber em uma página */
          .space-y-4 > * + * {
            margin-top: 0.5rem !important;
          }
          
          /* Compactar linhas da tabela */
          table td, table th {
            padding: 4px 6px !important;
            line-height: 1.3 !important;
          }
        }
      `}</style>
    </div>
  )
}
