import { getGroupByHref, getDefaultRouteByGroup } from "@/lib/nav-map"

/**
 * Smart back navigation: determina a rota de fallback baseado no grupo da rota atual
 */
export function getSmartBackRoute(currentPath: string): string {
  const group = getGroupByHref(currentPath)
  if (group) {
    const defaultRoute = getDefaultRouteByGroup(group)
    if (defaultRoute) {
      return defaultRoute
    }
  }
  // Fallback final: workspace principal
  return "/app"
}

