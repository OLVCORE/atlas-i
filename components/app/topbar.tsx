"use client"

import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/app/Breadcrumbs"
import { MobileSidebar } from "@/components/app/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenuClient } from "@/components/user-menu-client"
import { AssistantDrawer } from "@/components/assistant/AssistantDrawer"
import { getSmartBackRoute } from "@/lib/navigation"
import { getAppHistory } from "@/lib/app-history"

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  // Registrar rota atual no histórico e atualizar estado dos botões
  useEffect(() => {
    if (pathname) {
      const history = getAppHistory()
      history.push(pathname)
      setCanGoBack(history.canGoBack())
      setCanGoForward(history.canGoForward())
    }
  }, [pathname])

  const handleBack = () => {
    const history = getAppHistory()
    const backRoute = history.goBack()

    if (backRoute) {
      router.push(backRoute)
    } else {
      // Fallback determinístico se não houver histórico
      const fallbackRoute = pathname ? getSmartBackRoute(pathname) : "/app"
      router.push(fallbackRoute)
    }
  }

  const handleForward = () => {
    const history = getAppHistory()
    const forwardRoute = history.goForward()
    if (forwardRoute) {
      router.push(forwardRoute)
    }
  }

  const showNavigationButtons = pathname && pathname !== "/app" && pathname !== "/app/"

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        {/* Left: Mobile Sidebar + Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <MobileSidebar />
          <div className="hidden md:block min-w-0">
            <Breadcrumbs />
          </div>
          {showNavigationButtons && (
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={!canGoBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleForward}
                disabled={!canGoForward}
                className="flex items-center gap-2"
              >
                Avançar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <AssistantDrawer />
          <ThemeToggle />
          <UserMenuClient />
        </div>
      </div>
    </header>
  )
}

