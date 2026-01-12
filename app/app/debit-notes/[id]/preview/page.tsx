import { createClient } from "@/lib/supabase/server"
import { getActiveWorkspace } from "@/lib/workspace"
import { getDebitNoteById } from "@/lib/debit-notes"
import { listContracts } from "@/lib/contracts"
import { listEntities } from "@/lib/entities"
import { notFound, redirect } from "next/navigation"
import DebitNotePreview from "@/components/debit-notes/debit-note-preview"

export default async function DebitNotePreviewPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const workspace = await getActiveWorkspace()
  const debitNoteId = params.id

  // Buscar nota de débito
  const debitNote = await getDebitNoteById(debitNoteId)
  if (!debitNote) {
    notFound()
  }

  // Buscar contrato
  const contracts = await listContracts()
  const contract = contracts.find((c) => c.id === debitNote.contract_id)
  if (!contract) {
    notFound()
  }

  // Buscar entidade (cliente)
  const entities = await listEntities()
  const entity = entities.find((e) => e.id === contract.counterparty_entity_id)
  if (!entity) {
    notFound()
  }

  return <DebitNotePreview debitNote={debitNote} contract={contract} entity={entity} />
}
