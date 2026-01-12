/**
 * Lista de categorias padronizadas para despesas e receitas
 * Baseado em categorias comuns para gestão financeira pessoal e empresarial
 */

export const EXPENSE_CATEGORIES = [
  "Fixo – Imóvel",
  "Impostos – Imóvel",
  "Utilidades",
  "Telecom / TV",
  "Telecom / Internet",
  "Telecom / Telefonia",
  "Serviços Profissionais",
  "Imobilizado / Parcelamentos",
  "Pessoal / Remuneração",
  "Serviços Domésticos",
  "Habitação",
  "Impostos – Empresa",
  "Transporte",
  "Serviços Pessoais",
  "Associações / Entidades",
  "Saúde / Bem-estar",
  "Saúde",
  "Veículos",
  "Obras / Manutenção",
  "Tecnologia / Software",
  "Tecnologia / IA",
  "Tecnologia / Comunicação",
  "Tecnologia / Infraestrutura",
  "Tecnologia / Vendas",
  "Tecnologia / Apresentações",
  "Tecnologia / Produtividade",
  "Tecnologia / Design",
  "Marketing",
  "Manutenção",
  "Viagens",
  "Alimentação",
  "Educação",
  "Seguros",
  "Outros",
] as const

export const REVENUE_CATEGORIES = [
  "Vendas",
  "Serviços",
  "Consultoria",
  "Participações",
  "Investimentos",
  "Aluguéis",
  "Receitas Financeiras",
  "Outros",
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
export type RevenueCategory = typeof REVENUE_CATEGORIES[number]
export type Category = ExpenseCategory | RevenueCategory

export function getCategoriesByType(type: "expense" | "revenue"): readonly string[] {
  return type === "expense" ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES
}

export function findCategory(categoryName: string): Category | undefined {
  const allCategories = [...EXPENSE_CATEGORIES, ...REVENUE_CATEGORIES]
  return allCategories.find(cat => 
    cat.toLowerCase() === categoryName.toLowerCase() ||
    cat.toLowerCase().includes(categoryName.toLowerCase()) ||
    categoryName.toLowerCase().includes(cat.toLowerCase())
  )
}
