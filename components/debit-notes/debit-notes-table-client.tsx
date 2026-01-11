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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DebitNoteWithItems } from "@/lib/debit-notes"
import type { Contract } from "@/lib/contracts"
import { ReconcileDebitNoteDialog } from "./reconcile-debit-note-dialog"
import { DownloadDebitNoteButton } from "./download-debit-note-button"

type DebitNotesTableClientProps = {
  debitNotes: DebitNoteWithItems[]
  contracts: Contract[]
  entities: Array<{ id: string; legal_name: string }>
}

export function DebitNotesTableClient({
  debitNotes,
  contracts,
  entities,
}: DebitNotesTableClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [contractFilter, setContractFilter] = useState<string>("all")

  const getContractName = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId)
    return contract?.title || "Desconhecido"
  }

  const getEntityName = (contractId: string) => {
    const contract = contracts.find((c) => c.id === contractId)
    if (!contract) return "Desconhecido"
    const entity = entities.find((e) => e.id === contract.counterparty_entity_id)
    return entity?.legal_name || "Desconhecido"
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

  const getStatusLabel = (status: DebitNoteWithItems["status"]) => {
    const labels: Record<DebitNoteWithItems["status"], string> = {
      draft: "Rascunho",
      sent: "Enviada",
      paid: "Paga",
      cancelled: "Cancelada",
    }
    return labels[status]
  }

  const getStatusColor = (status: DebitNoteWithItems["status"]) => {
    const colors: Record<DebitNoteWithItems["status"], string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return colors[status]
  }

  // Filtrar notas
  let filteredNotes = debitNotes
  if (statusFilter !== "all") {
    filteredNotes = filteredNotes.filter((n) => n.status === statusFilter)
  }
  if (contractFilter !== "all") {
    filteredNotes = filteredNotes.filter((n) => n.contract_id === contractFilter)
  }

  if (filteredNotes.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {debitNotes.length === 0
          ? "Nenhuma nota de débito cadastrada. Crie uma nota acima."
          : "Nenhuma nota encontrada com os filtros selecionados."}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="paid">Paga</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filtrar por contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            {contracts.map((contract) => (
              <SelectItem key={contract.id} value={contract.id}>
                {contract.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotes.map((note) => (
              <TableRow key={note.id}>
                <TableCell className="font-medium">{note.number}</TableCell>
                <TableCell>{getContractName(note.contract_id)}</TableCell>
                <TableCell>{getEntityName(note.contract_id)}</TableCell>
                <TableCell>{formatCurrency(note.total_amount, note.currency)}</TableCell>
                <TableCell>{formatDate(note.issued_date)}</TableCell>
                <TableCell>{formatDate(note.due_date)}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                      note.status
                    )}`}
                  >
                    {getStatusLabel(note.status)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <DownloadDebitNoteButton debitNoteId={note.id} />
                    {note.status === "sent" && (
                      <ReconcileDebitNoteDialog debitNote={note} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
