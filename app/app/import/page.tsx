/**
 * MC12: Página de importação de planilhas
 */

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listEntities } from "@/lib/entities"
import { listAllAccounts } from "@/lib/accounts"
import { ImportWizard } from "@/components/import-wizard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ImportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  try {
    const entities = await listEntities()
    const accounts = await listAllAccounts()

    return (
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Importar Planilhas</h1>
          <p className="text-gray-600">
            Importe extratos bancários, cartões de crédito, investimentos e financiamentos via CSV
          </p>
        </div>

        <ImportWizard entities={entities} accounts={accounts} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Formato do CSV</CardTitle>
            <CardDescription>
              O arquivo CSV deve conter as seguintes colunas (nomes podem variar):
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Obrigatórias:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><code>Data</code> ou <code>Date</code> - Data da transação (DD/MM/YYYY ou YYYY-MM-DD)</li>
                  <li><code>Descrição</code>, <code>Histórico</code> ou <code>Description</code> - Descrição da transação</li>
                  <li><code>Valor</code>, <code>Débito</code>, <code>Crédito</code> ou <code>Amount</code> - Valor da transação</li>
                </ul>
              </div>
              <div>
                <strong>Opcionais:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><code>Conta</code> ou <code>Account</code> - Nome da conta</li>
                  <li><code>Categoria</code> ou <code>Category</code> - Categoria da transação</li>
                </ul>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <strong>Exemplo de formato:</strong>
                <pre className="mt-2 text-xs overflow-x-auto">
{`Data,Descrição,Valor
01/01/2024,Transferência recebida,1000.00
02/01/2024,Pagamento de conta,-150.50
03/01/2024,Compra no supermercado,-89.90`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
}

