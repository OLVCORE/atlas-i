"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Commitment } from "@/lib/commitments"
import type { FinancialSchedule } from "@/lib/schedules"
import { CancelCommitmentDialog } from "@/components/governance/CancelCommitmentDialog"
import { SettleCommitmentDialog } from "@/components/commitments/SettleCommitmentDialog"
import { canCancelCommitment } from "@/lib/governance/state-transitions"

type CommitmentsTableClientProps = {
  commitments: Commitment[]
  entities: Array<{ id: string; legal_name: string }>
  schedulesByCommitment: Record<string, FinancialSchedule[]>
  accounts?: Array<{ id: string; name: string; type: string }>
  onActivate: (id: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
  postTransactionFromCommitmentAction: (formData: FormData) => Promise<void>
}

export function CommitmentsTableClient({
  commitments,
  entities,
  schedulesByCommitment,
  accounts = [],
  onActivate,
  onCancel,
  postTransactionFromCommitmentAction,
}: CommitmentsTableClientProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [settleDialogOpen, setSettleDialogOpen] = useState(false)
  const [selectedCommitment, setSelectedCommitment] = useState<Commitment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getEntityName = (entityId: string) => {
    const entity = entities.find((e) => e.id === entityId)
    return entity?.legal_name || "Desconhecida"
  }

  const formatCurrency = (value: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
  }

  const getStatusLabel = (status: Commitment["status"]) => {
    const labels: Record<Commitment["status"], string> = {
      planned: "Planejado",
      active: "Ativo",
      completed: "Concluído",
      cancelled: "Cancelado",
    }
    return labels[status]
  }

  const getTypeLabel = (type: Commitment["type"]) => {
    return type === "expense" ? "Despesa" : "Receita"
  }

  const handleActivate = async (id: string) => {
    setLoadingId(id)
    try {
      await onActivate(id)
    } finally {
      setLoadingId(null)
    }
  }

  const handleCancelClick = (commitment: Commitment) => {
    setSelectedCommitment(commitment)
    setCancelDialogOpen(true)
    setError(null)
  }

  const handleCancelConfirm = async () => {
    if (!selectedCommitment) return
    
    setLoadingId(selectedCommitment.id)
    setError(null)
    try {
      await onCancel(selectedCommitment.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao cancelar compromisso"
      setError(errorMessage)
      // Não fechar o dialog se houver erro
      return
    } finally {
      setLoadingId(null)
    }
    // Só fecha se não houver erro
    setCancelDialogOpen(false)
    setSelectedCommitment(null)
  }

  const handleSettleClick = (commitment: Commitment) => {
    setSelectedCommitment(commitment)
    setSettleDialogOpen(true)
    setError(null)
  }

  const getCancelInfo = (commitment: Commitment) => {
    const schedules = schedulesByCommitment[commitment.id] || []
    const futureSchedules = schedules.filter(s => s.status === 'planned')
    const hasRealized = schedules.some(s => s.status === 'realized')
    return {
      futureCount: futureSchedules.length,
      hasRealized,
      canCancel: canCancelCommitment(commitment.status, hasRealized),
    }
  }

  if (commitments.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhum compromisso cadastrado. Crie um novo compromisso acima.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Entidade</TableHead>
            <TableHead>Valor Total</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commitments.map((commitment) => (
            <TableRow key={commitment.id}>
              <TableCell>
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    commitment.type === "expense"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-green-500/10 text-green-600 dark:text-green-400"
                  }`}
                >
                  {getTypeLabel(commitment.type)}
                </span>
              </TableCell>
              <TableCell className="font-medium">{commitment.description}</TableCell>
              <TableCell>{commitment.category || "-"}</TableCell>
              <TableCell>{getEntityName(commitment.entity_id)}</TableCell>
              <TableCell>{formatCurrency(commitment.total_amount, commitment.currency)}</TableCell>
              <TableCell>
                {formatDate(commitment.start_date)}
                {commitment.end_date && ` - ${formatDate(commitment.end_date)}`}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    commitment.status === "active"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : commitment.status === "completed"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : commitment.status === "cancelled"
                      ? "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                      : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  }`}
                >
                  {getStatusLabel(commitment.status)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/schedules?commitmentId=${commitment.id}`}>
                      Ver Cronograma
                    </Link>
                  </Button>
                  {commitment.status === "planned" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleActivate(commitment.id)}
                      disabled={loadingId === commitment.id}
                    >
                      Ativar
                    </Button>
                  )}
                  {(() => {
                    const cancelInfo = getCancelInfo(commitment)
                    // Só mostra botão se pode cancelar (regra de governança)
                    if (cancelInfo.canCancel) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelClick(commitment)}
                          disabled={loadingId === commitment.id}
                        >
                          Cancelar
                        </Button>
                      )
                    }
                    return null
                  })()}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {selectedCommitment && (
        <>
          <CancelCommitmentDialog
            open={cancelDialogOpen}
            onOpenChange={(open) => {
              setCancelDialogOpen(open)
              if (!open) {
                setSelectedCommitment(null)
                setError(null)
              }
            }}
            onConfirm={handleCancelConfirm}
            commitmentDescription={selectedCommitment.description}
            futureSchedulesCount={getCancelInfo(selectedCommitment).futureCount}
            hasRealizedSchedules={getCancelInfo(selectedCommitment).hasRealized}
          />
          <SettleCommitmentDialog
            open={settleDialogOpen}
            onOpenChange={(open) => {
              setSettleDialogOpen(open)
              if (!open) {
                setSelectedCommitment(null)
                setError(null)
              }
            }}
            commitmentId={selectedCommitment.id}
            entityId={selectedCommitment.entity_id}
            defaultAmount={Number(selectedCommitment.total_amount)}
            defaultDescription={selectedCommitment.description}
            accounts={accounts}
            postTransactionFromCommitmentAction={postTransactionFromCommitmentAction}
          />
        </>
      )}
      
      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

