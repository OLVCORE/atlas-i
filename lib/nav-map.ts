import {
  Building2,
  Wallet,
  CreditCard,
  FileText,
  ShoppingCart,
  Receipt,
  Link as LinkIcon,
  Calendar,
  FileCheck,
  BarChart3,
  LayoutDashboard,
  Bell,
  Upload,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  group: string
  description?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: "Cadastros",
    items: [
      {
        label: "Entidades",
        href: "/app/entities",
        icon: Building2,
        group: "Cadastros",
        description: "Pessoas físicas e jurídicas",
      },
      {
        label: "Contas",
        href: "/app/accounts",
        icon: Wallet,
        group: "Cadastros",
        description: "Contas bancárias e financeiras",
      },
      {
        label: "Cartões",
        href: "/app/cards",
        icon: CreditCard,
        group: "Cadastros",
        description: "Cartões de crédito",
      },
    ],
  },
  {
    title: "Financeiro",
    items: [
      {
        label: "Ledger",
        href: "/app/ledger",
        icon: FileText,
        group: "Financeiro",
        description: "Lançamentos contábeis",
      },
      {
        label: "Cartões: Compras",
        href: "/app/purchases",
        icon: ShoppingCart,
        group: "Financeiro",
        description: "Compras parceladas no cartão",
      },
      {
        label: "Cartões: Parcelas",
        href: "/app/installments",
        icon: Receipt,
        group: "Financeiro",
        description: "Faturas e parcelas do cartão",
      },
    ],
  },
  {
    title: "Operações",
    items: [
      {
        label: "Conexões",
        href: "/app/connections",
        icon: LinkIcon,
        group: "Operações",
        description: "Integrações bancárias",
      },
      {
        label: "Compromissos",
        href: "/app/commitments",
        icon: Calendar,
        group: "Operações",
        description: "Compromissos financeiros",
      },
      {
        label: "Contratos",
        href: "/app/contracts",
        icon: FileCheck,
        group: "Operações",
        description: "Contratos e projetos",
      },
      {
        label: "Cronogramas",
        href: "/app/schedules",
        icon: BarChart3,
        group: "Operações",
        description: "Cronogramas financeiros (Contas a Pagar / Receber)",
      },
      {
        label: "Importar Planilhas",
        href: "/app/import",
        icon: Upload,
        group: "Operações",
        description: "Importar extratos bancários, cartões e investimentos via CSV",
      },
    ],
  },
  {
    title: "Relatórios",
    items: [
      {
        label: "Dashboard",
        href: "/app/dashboard",
        icon: LayoutDashboard,
        group: "Relatórios",
        description: "Dashboard executivo com KPIs e métricas-chave",
      },
      {
        label: "Alertas",
        href: "/app/alerts",
        icon: Bell,
        group: "Relatórios",
        description: "Alertas inteligentes de riscos e vencimentos",
      },
      {
        label: "Fluxo de Caixa",
        href: "/app/cashflow",
        icon: BarChart3,
        group: "Relatórios",
        description: "Fluxo de caixa previsto e realizado",
      },
    ],
  },
]

// Mapa rápido para breadcrumbs e títulos
export const routeMetaByHref: Record<string, { label: string; group: string }> = {}

// Preencher o mapa
navGroups.forEach((group) => {
  group.items.forEach((item) => {
    routeMetaByHref[item.href] = {
      label: item.label,
      group: item.group,
    }
  })
})

// Rotas padrão por grupo para fallback do botão "Voltar"
export const defaultRouteByGroup: Record<string, string> = {
  Cadastros: "/app/entities",
  Financeiro: "/app/ledger",
  Operações: "/app/schedules",
  Relatórios: "/app/cashflow",
}

// Buscar grupo de uma rota
export function getGroupByHref(href: string): string | null {
  const meta = routeMetaByHref[href]
  return meta?.group || null
}

// Buscar rota padrão de um grupo
export function getDefaultRouteByGroup(group: string): string | null {
  return defaultRouteByGroup[group] || null
}

