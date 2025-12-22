"use client"

import { useState } from "react"
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
import type { Contract } from "@/lib/contracts"
import type { ContractSchedule } from "@/lib/schedules"
import { CancelContractDialog } from "@/components/governance/CancelContractDialog"
import { canCancelContract } from "@/lib/governance/state-transitions"

type ContractsTableClientProps = {
  contracts: Contract[]
  entities: Array<{ id: string; legal_name: string }>
  schedulesByContract: Record<string, ContractSchedule[]>
  onCancel: (id: string) => Promise<void>
}

export function ContractsTableClient({
  contracts,
  entities,
  schedulesByContract,
  onCancel,
}: ContractsTableClientProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
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

  const getStatusLabel = (status: Contract["status"]) => {
    const labels: Record<Contract["status"], string> = {
      draft: "Rascunho",
      active: "Ativo",
      completed: "Concluído",
      cancelled: "Cancelado",
    }
    return labels[status]
  }

  const handleCancelClick = (contract: Contract) => {
    setSelectedContract(contract)
    setCancelDialogOpen(true)
    setError(null)
  }

  const handleCancelConfirm = async () => {
    if (!selectedContract) return
    
    setLoadingId(selectedContract.id)
    setError(null)
    try {
      await onCancel(selectedContract.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao cancelar contrato"
      setError(errorMessage)
      return
    } finally {
      setLoadingId(null)
    }
    setCancelDialogOpen(false)
    setSelectedContract(null)
  }

  const getCancelInfo = (contract: Contract) => {
    const schedules = schedulesByContract[contract.id] || []
    const futureSchedules = schedules.filter(s => s.status === 'planned')
    const hasRealized = schedules.some(s => s.status === 'received' || s.status === 'paid')
    return {
      futureCount: futureSchedules.length,
      hasRealized,
      canCancel: canCancelContract(contract.status, hasRealized),
    }
  }

  if (contracts.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhum contrato cadastrado. Crie um novo contrato acima.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Contraparte</TableHead>
            <TableHead>Valor Total</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell className="font-medium">{contract.title}</TableCell>
              <TableCell>{getEntityName(contract.counterparty_entity_id)}</TableCell>
              <TableCell>{formatCurrency(contract.total_value, contract.currency)}</TableCell>
              <TableCell>
                {formatDate(contract.start_date)}
                {contract.end_date && ` - ${formatDate(contract.end_date)}`}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    contract.status === "active"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : contract.status === "completed"
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : contract.status === "cancelled"
                      ? "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                      : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  }`}
                >
                  {getStatusLabel(contract.status)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/schedules?contractId=${contract.id}`}>
                      Ver Cronograma
                    </Link>
                  </Button>
                  {(() => {
                    const cancelInfo = getCancelInfo(contract)
                    if (cancelInfo.canCancel) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelClick(contract)}
                          disabled={loadingId === contract.id}
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
      
      {selectedContract && (
        <CancelContractDialog
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            setCancelDialogOpen(open)
            if (!open) {
              setSelectedContract(null)
              setError(null)
            }
          }}
          onConfirm={handleCancelConfirm}
          contractTitle={selectedContract.title}
          futureSchedulesCount={getCancelInfo(selectedContract).futureCount}
          hasRealizedSchedules={getCancelInfo(selectedContract).hasRealized}
        />
      )}
      
      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

