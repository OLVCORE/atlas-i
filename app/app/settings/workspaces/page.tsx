import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listWorkspaces, createWorkspace } from "@/lib/workspace"
import { setActiveWorkspaceId } from "@/lib/workspace-active"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getOrSetActiveWorkspace } from "@/lib/workspace-active"

async function createWorkspaceAction(formData: FormData) {
  "use server"

  const name = formData.get("name") as string

  if (!name || name.trim().length === 0) {
    throw new Error("Nome do workspace é obrigatório")
  }

  await createWorkspace(name.trim())
  redirect("/app/settings/workspaces")
}

async function switchWorkspaceAction(formData: FormData) {
  "use server"

  const workspaceId = formData.get("workspaceId") as string

  if (!workspaceId) {
    throw new Error("Workspace ID é obrigatório")
  }

  await setActiveWorkspaceId(workspaceId)
  redirect("/app")
}

export default async function WorkspacesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let workspaces = []
  let activeWorkspaceId = null

  try {
    workspaces = await listWorkspaces()
    activeWorkspaceId = await getOrSetActiveWorkspace()
  } catch (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar workspaces</CardTitle>
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

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground">
            Gerencie seus workspaces e alterne entre eles
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createWorkspaceAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Workspace</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Empresa XYZ"
                  required
                />
              </div>
              <Button type="submit">Criar Workspace</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meus Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            {workspaces.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhum workspace encontrado. Crie um workspace acima.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.map((workspace) => {
                    const isActive = workspace.id === activeWorkspaceId
                    return (
                      <TableRow key={workspace.id}>
                        <TableCell className="font-medium">
                          {workspace.name}
                        </TableCell>
                        <TableCell>
                          {new Date(workspace.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              Ativo
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Inativo
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!isActive && (
                            <form action={switchWorkspaceAction}>
                              <input type="hidden" name="workspaceId" value={workspace.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Tornar Ativo
                              </Button>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

