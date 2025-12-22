"use client"

import { useState } from "react"
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
import { HelpTooltip } from "@/components/help/HelpTooltip"
import type { FinancialSchedule } from "@/lib/schedules"
import type { Commitment } from "@/lib/commitments"
import type { Contract } from "@/lib/contracts"

type SchedulesTableClientProps = {
  schedules: any[] // NormalizedSchedule (pode ser FinancialSchedule ou ContractSchedule)
  commitments: Commitment[]
  contracts: Contract[]
  entities: Array<{ id: string; legal_name: string }>
  onRealize?: (scheduleKind: 'commitment' | 'contract', scheduleId: string) => Promise<{ ok: boolean; error?: string; message?: string }>
}

export function SchedulesTableClient({
  schedules,
  commitments,
  contracts,
  entities,
  onRealize,
}: SchedulesTableClientProps) {
  const router = useRouter()
  const [realizingScheduleId, setRealizingScheduleId] = useState<string | null>(null)
  const [realizeError, setRealizeError] = useState<string | null>(null)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR")
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      planned: "Planejado",
      realized: "Realizado",
      received: "Recebido",
      paid: "Pago",
      cancelled: "Cancelado",
    }
    return labels[status] || status
  }

  const handleRealize = async (schedule: any) => {
    if (!onRealize) return

    const scheduleKind = schedule.source === 'commitment' || schedule.commitment_id ? 'commitment' : 'contract'
    setRealizingScheduleId(schedule.id)
    setRealizeError(null)

    try {
      const result = await onRealize(scheduleKind, schedule.id)
      if (result.ok) {
        router.refresh()
      } else {
        setRealizeError(result.error || "Erro ao realizar schedule")
      }
    } catch (error) {
      setRealizeError(error instanceof Error ? error.message : "Erro desconhecido")
    } finally {
      setRealizingScheduleId(null)
    }
  }

  const getCommitmentInfo = (commitmentId: string) => {
    const commitment = commitments.find((c) => c.id === commitmentId)
    if (!commitment) return null
    
    const entity = entities.find((e) => e.id === commitment.entity_id)
    return {
      description: commitment.description,
      type: commitment.type === "expense" ? "Despesa" : "Receita",
      entityName: entity?.legal_name || "Desconhecida",
    }
  }

  if (schedules.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhum cronograma encontrado. Crie compromissos ou contratos para gerar cronogramas.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Legenda:</span>
        <span className="inline-block rounded px-2 py-1 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          Planejado
        </span>
        <span className="inline-block rounded px-2 py-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400">
          Realizado
        </span>
        <span className="inline-block rounded px-2 py-1 text-xs bg-gray-500/10 text-gray-600 dark:text-gray-400">
          Cancelado
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  Data de Vencimento
                  <HelpTooltip contentKey="schedules.due_date" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  Valor
                  <HelpTooltip contentKey="schedules.amount" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  Status
                  <HelpTooltip contentKey="schedules.status" />
                </div>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule: any) => {
              // Lidar com schedules de commitments e contracts
              const isCommitment = schedule.source === 'commitment' || schedule.commitment_id
              const commitmentId = schedule.commitment_id || (isCommitment ? schedule.referenceId : null)
              const contractId = schedule.contract_id || (!isCommitment ? schedule.referenceId : null)
              
              const commitmentInfo = commitmentId ? getCommitmentInfo(commitmentId) : null
              
              // Buscar info do contrato se for schedule de contrato
              let contractInfo = null
              if (contractId) {
                const contract = contracts.find((c) => c.id === contractId)
                if (contract) {
                  const entity = entities.find((e) => e.id === contract.counterparty_entity_id)
                  contractInfo = {
                    title: contract.title,
                    type: schedule.type === 'receivable' ? 'Recebível' : 'Pagável',
                    entityName: entity?.legal_name || "Desconhecida",
                  }
                }
              }
              
              return (
                <TableRow key={schedule.id}>
                  <TableCell>
                    {commitmentInfo ? (
                      <div>
                        <div className="font-medium">{commitmentInfo.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {commitmentInfo.entityName}
                        </div>
                      </div>
                    ) : contractInfo ? (
                      <div>
                        <div className="font-medium">{contractInfo.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {contractInfo.entityName}
                        </div>
                      </div>
                    ) : (
                      schedule.source === 'contract' ? "Contrato" : "Compromisso"
                    )}
                  </TableCell>
                  <TableCell>
                    {commitmentInfo ? (
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          commitmentInfo.type === "Despesa"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-green-500/10 text-green-600 dark:text-green-400"
                        }`}
                      >
                        {commitmentInfo.type}
                      </span>
                    ) : contractInfo ? (
                      <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {contractInfo.type}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(schedule.due_date)}</TableCell>
                  <TableCell>{formatCurrency(schedule.amount)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                        schedule.status === "realized" || schedule.status === "received" || schedule.status === "paid"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : schedule.status === "cancelled"
                          ? "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                          : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {getStatusLabel(schedule.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      {realizeError && schedule.id === realizingScheduleId && (
                        <span className="text-xs text-destructive">{realizeError}</span>
                      )}
                      <div className="flex justify-end gap-2">
                        {schedule.status === "planned" && onRealize && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleRealize(schedule)}
                            disabled={realizingScheduleId === schedule.id}
                          >
                            {realizingScheduleId === schedule.id ? "Realizando..." : "Realizar no Ledger"}
                          </Button>
                        )}
                        {(schedule.status === "realized" || schedule.status === "received" || schedule.status === "paid") && schedule.linked_transaction_id && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/app/ledger?transactionId=${schedule.linked_transaction_id}`}>
                              Ver Transaction
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

