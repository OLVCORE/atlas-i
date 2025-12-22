"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

type Entity = {
  id: string
  type: "PF" | "PJ"
  legal_name: string
  document: string
  created_at: string
}

export function EntitiesTableClient({
  entities,
  onEditAction,
  onDeleteAction,
  onRefreshAction,
}: {
  entities: Entity[]
  onEditAction: (entityId: string) => Promise<void>
  onDeleteAction: (entityId: string) => Promise<void>
  onRefreshAction: (entityId: string) => Promise<void>
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  const handleDelete = async (entityId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Tem certeza que deseja excluir esta entidade?")) {
      return
    }

    setDeletingId(entityId)
    try {
      await onDeleteAction(entityId)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao excluir entidade")
    } finally {
      setDeletingId(null)
    }
  }

  const handleEdit = async (entityId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await onEditAction(entityId)
  }

  const handleRefresh = async (entityId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRefreshingId(entityId)
    try {
      await onRefreshAction(entityId)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao atualizar dados")
    } finally {
      setRefreshingId(null)
    }
  }

  if (entities.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhuma entidade cadastrada. Crie uma entidade acima.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Nome/Razão Social</TableHead>
          <TableHead>Documento</TableHead>
          <TableHead>Criado em</TableHead>
          <TableHead className="w-[140px]">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entities.map((entity) => (
          <TableRow
            key={entity.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onEditAction(entity.id)}
          >
            <TableCell>{entity.type}</TableCell>
            <TableCell className="font-medium">{entity.legal_name}</TableCell>
            <TableCell>{entity.document}</TableCell>
            <TableCell>
              {new Date(entity.created_at).toLocaleDateString("pt-BR")}
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleEdit(entity.id, e)}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {entity.type === "PJ" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleRefresh(entity.id, e)}
                    disabled={refreshingId === entity.id}
                    title="Atualizar dados da API"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${refreshingId === entity.id ? "animate-spin" : ""}`}
                    />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDelete(entity.id, e)}
                  disabled={deletingId === entity.id}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

