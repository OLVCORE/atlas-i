import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"

export default async function AppPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  try {
    const workspace = await getActiveWorkspace()

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Workspace Ativo</h2>
          <p className="text-muted-foreground">{workspace.name}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/app/entities">
            <div className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors">
              <h3 className="text-lg font-semibold mb-2">Entidades</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie pessoas físicas e jurídicas
              </p>
            </div>
          </Link>
          <Link href="/app/accounts">
            <div className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors">
              <h3 className="text-lg font-semibold mb-2">Contas</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie contas financeiras
              </p>
            </div>
          </Link>
          <Link href="/app/ledger">
            <div className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors">
              <h3 className="text-lg font-semibold mb-2">Ledger</h3>
              <p className="text-sm text-muted-foreground">
                Registre transações financeiras
              </p>
            </div>
          </Link>
        </div>
      </div>
    )
  } catch (error) {
    let errorMessage = "Erro desconhecido"
    
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message)
    } else if (error && typeof error === 'object' && 'details' in error) {
      errorMessage = String(error.details)
    } else if (error) {
      errorMessage = String(error)
    }
    
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h2 className="text-lg font-semibold text-destructive">Erro ao carregar workspace</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Se o erro persistir, verifique se a migration SQL foi executada corretamente no Supabase.
          </p>
        </div>
      </div>
    )
  }
}

