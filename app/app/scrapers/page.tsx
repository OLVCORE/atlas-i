/**
 * MC13: Página de configuração de scrapers bancários
 */

import { createClient } from "@/lib/supabase/server"
import { listAllEntities } from "@/lib/entities"
import { listAllAccounts } from "@/lib/accounts"
import { ScrapersManager } from "@/components/scrapers-manager"

export default async function ScrapersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Não autenticado</div>
  }

  const entities = await listAllEntities()
  const accounts = await listAllAccounts()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scrapers Bancários</h1>
        <p className="text-muted-foreground mt-2">
          Configure conexões automáticas com seus bancos para importação automática de extratos
        </p>
      </div>

      <ScrapersManager entities={entities} accounts={accounts} />
    </div>
  )
}

