import { getActiveWorkspace } from "@/lib/workspace"
import { getDebitNoteById } from "@/lib/debit-notes"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"
import { notFound } from "next/navigation"
import DebitNotePreview from "@/components/debit-notes/debit-note-preview"

export default async function DebitNotePreviewPage({
  params,
}: {
  params: { id: string }
}) {
  const workspace = await getActiveWorkspace()
  const debitNoteId = params.id

  // Buscar nota de débito
  const debitNote = await getDebitNoteById(debitNoteId)
  if (!debitNote) {
    notFound()
  }

  let contract: Awaited<ReturnType<typeof listContracts>>[number] | null = null
  let entity: Awaited<ReturnType<typeof listEntities>>[number] | null = null
  const entities = await listEntities()

  if (debitNote.contract_id) {
    const contracts = await listContracts()
    contract = contracts.find((c) => c.id === debitNote.contract_id) ?? null
    if (contract) {
      entity = entities.find((e) => e.id === contract!.counterparty_entity_id) ?? null
    }
  }
  // Nota avulsa ou sem entidade do contrato: usar entity_id gravado na nota
  if (!entity && debitNote.entity_id) {
    entity = entities.find((e) => e.id === debitNote.entity_id) ?? null
  }

  return <DebitNotePreview debitNote={debitNote} contract={contract} entity={entity} />
}
