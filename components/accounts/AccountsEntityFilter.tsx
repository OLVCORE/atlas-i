"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AccountsEntityFilterProps = {
  entities: Array<{ id: string; legal_name: string }>
  selectedEntityId?: string | null
}

export function AccountsEntityFilter({ entities, selectedEntityId }: AccountsEntityFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleEntityChange = (entityId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (entityId === "all" || entityId === "") {
      params.delete("entity_id")
    } else {
      params.set("entity_id", entityId)
    }

    router.push(`/app/accounts?${params.toString()}`)
  }

  const currentEntityId = selectedEntityId || "all"

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="entity-filter">Entidade</Label>
      <Select value={currentEntityId} onValueChange={handleEntityChange}>
        <SelectTrigger id="entity-filter" className="w-[250px]">
          <SelectValue placeholder="Todas as entidades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Consolidado (todas as entidades)</SelectItem>
          {entities.map((entity) => (
            <SelectItem key={entity.id} value={entity.id}>
              {entity.legal_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

