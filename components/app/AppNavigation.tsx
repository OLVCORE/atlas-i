"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navGroups = [
  {
    label: "Cadastro",
    items: [
      { href: "/app/entities", label: "Entidades" },
      { href: "/app/accounts", label: "Contas" },
      { href: "/app/cards", label: "Cartões" },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/app/ledger", label: "Ledger" },
      { href: "/app/purchases", label: "Compras" },
      { href: "/app/installments", label: "Parcelas" },
      { href: "/app/connections", label: "Conexões" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/app/commitments", label: "Compromissos" },
      { href: "/app/contracts", label: "Contratos" },
      { href: "/app/schedules", label: "Cronogramas" },
      { href: "/app/cashflow", label: "Fluxo de Caixa" },
    ],
  },
]

export function AppNavigation() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
      {navGroups.map((group, groupIndex) => (
        <div key={group.label} className="flex items-center">
          {groupIndex > 0 && (
            <span className="mx-2 text-muted-foreground">•</span>
          )}
          {group.items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-primary hover:bg-accent rounded-md"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

