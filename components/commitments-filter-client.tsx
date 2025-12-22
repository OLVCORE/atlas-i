"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type Entity = {
  id: string
  legal_name: string
  type: "PF" | "PJ"
}

type CommitmentsFilterClientProps = {
  entities: Entity[]
  selectedEntityId?: string
}

export function CommitmentsFilterClient({ entities, selectedEntityId }: CommitmentsFilterClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleEntityChange = (entityId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (entityId === "all") {
      params.delete("entity_id")
    } else {
      params.set("entity_id", entityId)
    }
    router.push(`/app/commitments?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4">
      <Label htmlFor="entity-filter" className="text-sm font-medium">
        Filtrar por Entidade:
      </Label>
      <Select
        value={selectedEntityId || "all"}
        onValueChange={handleEntityChange}
      >
        <SelectTrigger id="entity-filter" className="w-[250px]">
          <SelectValue placeholder="Todas as Entidades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Entidades</SelectItem>
          {entities.map((entity) => (
            <SelectItem key={entity.id} value={entity.id}>
              {entity.legal_name} ({entity.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

