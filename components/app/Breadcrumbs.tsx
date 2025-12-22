"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { routeMetaByHref } from "@/lib/nav-map"

export function Breadcrumbs() {
  const pathname = usePathname()
  
  if (!pathname || pathname === "/app") {
    return (
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
        <Link href="/app" className="hover:text-primary flex items-center">
          <Home className="h-4 w-4 mr-1" />
          Workspace
        </Link>
      </nav>
    )
  }

  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs = segments.map((segment, index) => {
    const path = "/" + segments.slice(0, index + 1).join("/")
    const meta = routeMetaByHref[path]
    const label = meta?.label || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
    return { path, label }
  })

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      <Link href="/app" className="hover:text-primary flex items-center">
        <Home className="h-4 w-4 mr-1" />
        Workspace
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4" />
          {index === breadcrumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.path} className="hover:text-primary">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}

