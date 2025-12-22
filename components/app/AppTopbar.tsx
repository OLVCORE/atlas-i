"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, ChevronDown, Home } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// Todos os itens de navegação em uma lista plana
const allNavItems = [
  { href: "/app/entities", label: "Entidades" },
  { href: "/app/accounts", label: "Contas" },
  { href: "/app/cards", label: "Cartões" },
  { href: "/app/ledger", label: "Ledger" },
  { href: "/app/purchases", label: "Compras" },
  { href: "/app/installments", label: "Parcelas" },
  { href: "/app/connections", label: "Conexões" },
  { href: "/app/commitments", label: "Compromissos" },
  { href: "/app/contracts", label: "Contratos" },
  { href: "/app/schedules", label: "Cronogramas" },
  { href: "/app/cashflow", label: "Fluxo de Caixa" },
]

// Itens primários (os primeiros 6-7 que sempre aparecem)
const PRIMARY_ITEMS_COUNT = 6
const primaryItems = allNavItems.slice(0, PRIMARY_ITEMS_COUNT)
const moreItems = allNavItems.slice(PRIMARY_ITEMS_COUNT)

type NavLinkProps = {
  href: string
  label: string
  isActive: boolean
  className?: string
  onClick?: () => void
}

function NavLink({ href, label, isActive, className, onClick }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
        isActive
          ? "text-primary border-b-2 border-primary"
          : "text-muted-foreground hover:text-primary hover:bg-accent rounded-md",
        className
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  )
}

export function AppTopbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Fechar menu mobile ao navegar
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1 min-w-0 flex-1 overflow-hidden justify-center">
        <div className="flex items-center gap-1 flex-nowrap">
          {primaryItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              isActive={pathname === item.href}
            />
          ))}
          {moreItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "px-3 py-2 text-sm font-medium whitespace-nowrap shrink-0 h-auto",
                    moreItems.some((item) => pathname === item.href)
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-primary hover:bg-accent rounded-md"
                  )}
                >
                  Mais
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {moreItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center",
                        pathname === item.href && "bg-accent font-medium"
                      )}
                    >
                      {item.label}
                      {pathname === item.href && (
                        <span className="ml-auto text-primary">●</span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>

      {/* Mobile Navigation - Hamburger */}
      <div className="md:hidden flex items-center">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px]">
            <SheetHeader>
              <SheetTitle>Navegação</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-1">
              <Link
                href="/app"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  pathname === "/app"
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Home className="h-4 w-4" />
                Workspace
              </Link>
              <div className="pt-4">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cadastros
                </div>
                {allNavItems
                  .filter((item) =>
                    ["/app/entities", "/app/accounts", "/app/cards"].includes(item.href)
                  )
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                        pathname === item.href
                          ? "bg-accent text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      aria-current={pathname === item.href ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
              <div className="pt-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Operações
                </div>
                {allNavItems
                  .filter((item) =>
                    ["/app/ledger", "/app/purchases", "/app/installments", "/app/connections"].includes(
                      item.href
                    )
                  )
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                        pathname === item.href
                          ? "bg-accent text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      aria-current={pathname === item.href ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
              <div className="pt-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Planejamento
                </div>
                {allNavItems
                  .filter((item) =>
                    [
                      "/app/commitments",
                      "/app/contracts",
                      "/app/schedules",
                      "/app/cashflow",
                    ].includes(item.href)
                  )
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                        pathname === item.href
                          ? "bg-accent text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      aria-current={pathname === item.href ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

