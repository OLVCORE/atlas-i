import { createClient } from "@/lib/supabase/server"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { LogOut, Settings } from "lucide-react"
import { redirect } from "next/navigation"
import Link from "next/link"

async function signOut() {
  "use server"
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function UserMenu() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { getActiveWorkspace } = await import("@/lib/workspace")
  let workspace = null
  try {
    workspace = await getActiveWorkspace()
  } catch (error) {
    // Se não conseguir carregar workspace, continua sem mostrar
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium leading-none">{user.email}</div>
              {workspace && (
                <div className="text-xs text-muted-foreground leading-none mt-0.5">
                  {workspace.name}
                </div>
              )}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            {workspace && (
              <p className="text-xs leading-none text-muted-foreground">
                Workspace: {workspace.name}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/workspaces" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Workspaces</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full flex items-center text-left">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
