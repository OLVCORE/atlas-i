import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntityById,
} from "@/lib/entities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EntityForm } from "@/components/entity-form"
import { EntitiesTableClient } from "@/components/entities-table-client"

async function createEntityAction(data: {
  type: "PF" | "PJ"
  legalName: string
  document: string
  tradeName?: string
  registrationStatus?: string
  foundationDate?: string
  mainActivityCode?: string
  mainActivityDesc?: string
  addressStreet?: string
  addressNumber?: string
  addressComplement?: string
  addressDistrict?: string
  addressCity?: string
  addressState?: string
  addressZip?: string
  phone?: string
  email?: string
  enrichmentPayload?: any
  enrichmentProvider?: string
}) {
  "use server"

  const {
    type,
    legalName,
    document,
    tradeName,
    registrationStatus,
    foundationDate,
    mainActivityCode,
    mainActivityDesc,
    addressStreet,
    addressNumber,
    addressComplement,
    addressDistrict,
    addressCity,
    addressState,
    addressZip,
    phone,
    email,
    enrichmentPayload,
    enrichmentProvider,
  } = data

  if (!type || !legalName || !document) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  // Determinar se houve enriquecimento
  const hasEnrichment = !!enrichmentPayload

  await createEntity(
    type,
    legalName,
    document,
    hasEnrichment
      ? {
          tradeName,
          registrationStatus,
          registrationStatusDate: undefined,
          foundationDate,
          mainActivityCode,
          mainActivityDesc,
          addressStreet,
          addressNumber,
          addressComplement,
          addressDistrict,
          addressCity,
          addressState,
          addressZip,
          phone,
          email,
          sourceProvider: enrichmentProvider || "brasilapi",
          sourceFetchedAt: new Date().toISOString(),
          enrichmentPayload: enrichmentPayload,
        }
      : undefined
  )

  redirect("/app/entities")
}

async function updateEntityAction(
  entityId: string,
  data: {
    type: "PF" | "PJ"
    legalName: string
    document: string
    tradeName?: string
    registrationStatus?: string
    foundationDate?: string
    mainActivityCode?: string
    mainActivityDesc?: string
    addressStreet?: string
    addressNumber?: string
    addressComplement?: string
    addressDistrict?: string
    addressCity?: string
    addressState?: string
    addressZip?: string
    phone?: string
    email?: string
    enrichmentPayload?: any
    enrichmentProvider?: string
  }
) {
  "use server"

  const {
    type,
    legalName,
    document,
    tradeName,
    registrationStatus,
    foundationDate,
    mainActivityCode,
    mainActivityDesc,
    addressStreet,
    addressNumber,
    addressComplement,
    addressDistrict,
    addressCity,
    addressState,
    addressZip,
    phone,
    email,
    enrichmentPayload,
    enrichmentProvider,
  } = data

  if (!type || !legalName || !document) {
    throw new Error("Preencha todos os campos obrigatórios")
  }

  const hasEnrichment = !!enrichmentPayload

  await updateEntity(
    entityId,
    type,
    legalName,
    document,
    hasEnrichment
      ? {
          tradeName,
          registrationStatus,
          registrationStatusDate: undefined,
          foundationDate,
          mainActivityCode,
          mainActivityDesc,
          addressStreet,
          addressNumber,
          addressComplement,
          addressDistrict,
          addressCity,
          addressState,
          addressZip,
          phone,
          email,
          sourceProvider: enrichmentProvider || "brasilapi",
          sourceFetchedAt: new Date().toISOString(),
          enrichmentPayload: enrichmentPayload,
        }
      : undefined
  )

  redirect("/app/entities")
}

async function deleteEntityAction(entityId: string) {
  "use server"
  await deleteEntity(entityId)
  redirect("/app/entities")
}

async function editEntityAction(entityId: string) {
  "use server"
  redirect(`/app/entities?edit=${entityId}`)
}

async function refreshEntityAction(entityId: string) {
  "use server"
  const entity = await getEntityById(entityId)
  if (entity && entity.type === "PJ") {
    redirect(`/app/entities?edit=${entityId}&refresh=1`)
  } else {
    redirect("/app/entities")
  }
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: { edit?: string; refresh?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let entities = []
  try {
    entities = await listEntities()
  } catch (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar entities</CardTitle>
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

  let entityToEdit = null
  if (searchParams.edit) {
    try {
      entityToEdit = await getEntityById(searchParams.edit)
    } catch (error) {
      // Ignorar erro, deixar entityToEdit como null
    }
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Entidades</h1>
          <p className="text-muted-foreground">
            Gerencie pessoas físicas e jurídicas do seu workspace
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {entityToEdit ? "Editar Entidade" : "Nova Entidade"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EntityForm
              onSubmit={
                entityToEdit
                  ? async (data) => {
                      await updateEntityAction(entityToEdit.id, data)
                    }
                  : createEntityAction
              }
              initialData={
                entityToEdit
                  ? {
                      id: entityToEdit.id,
                      type: entityToEdit.type,
                      legalName: entityToEdit.legal_name,
                      document: entityToEdit.document,
                      tradeName: entityToEdit.trade_name || undefined,
                      registrationStatus: entityToEdit.registration_status || undefined,
                      foundationDate: entityToEdit.foundation_date
                        ? entityToEdit.foundation_date.split("T")[0]
                        : undefined,
                      mainActivityCode: entityToEdit.main_activity_code || undefined,
                      mainActivityDesc: entityToEdit.main_activity_desc || undefined,
                      addressStreet: entityToEdit.address_street || undefined,
                      addressNumber: entityToEdit.address_number || undefined,
                      addressComplement: entityToEdit.address_complement || undefined,
                      addressDistrict: entityToEdit.address_district || undefined,
                      addressCity: entityToEdit.address_city || undefined,
                      addressState: entityToEdit.address_state || undefined,
                      addressZip: entityToEdit.address_zip || undefined,
                      phone: entityToEdit.phone || undefined,
                      email: entityToEdit.email || undefined,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entidades Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            <EntitiesTableClient
              entities={entities}
              onEditAction={editEntityAction}
              onDeleteAction={deleteEntityAction}
              onRefreshAction={refreshEntityAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
