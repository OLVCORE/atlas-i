/**
 * MC12: API endpoint para download de templates de CSV
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get("type") || "standard"

  let csvContent = ""
  let filename = "template.csv"

  switch (type) {
    case "checking":
      csvContent = `Data,Descrição,Valor
01/01/2024,Transferência recebida,1000.00
02/01/2024,Pagamento de conta,-150.50
03/01/2024,Compra no supermercado,-89.90`
      filename = "template_conta_corrente.csv"
      break

    case "card":
      csvContent = `Data,Descrição,Valor
01/01/2024,Parcela 1/10 - Compra no supermercado,150.00
02/01/2024,Parcela 2/10 - Compra no supermercado,150.00
03/01/2024,Compra à vista - Posto de gasolina,80.50`
      filename = "template_cartao_credito.csv"
      break

    case "investment":
      csvContent = `Data,Descrição,Valor
01/01/2024,Aplicação em CDB,5000.00
15/01/2024,Resgate parcial CDB,-2000.00
31/01/2024,Rendimento CDB,50.00`
      filename = "template_investimento.csv"
      break

    default:
      csvContent = `Data,Descrição,Valor
01/01/2024,Transferência recebida,1000.00
02/01/2024,Pagamento de conta,-150.50
03/01/2024,Compra no supermercado,-89.90`
      filename = "template.csv"
  }

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

