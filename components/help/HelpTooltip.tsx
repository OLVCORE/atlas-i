"use client"

import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getHelpContent, type HelpContent } from "@/lib/help/registry"
import { cn } from "@/lib/utils"

type HelpTooltipProps = {
  contentKey: string
  customContent?: HelpContent
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
}

export function HelpTooltip({
  contentKey,
  customContent,
  side = "top",
  align = "center",
  className,
}: HelpTooltipProps) {
  const content = customContent || getHelpContent(contentKey)

  if (!content) {
    return null
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Informação sobre ${content.title}`}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              className
            )}
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs text-left"
        >
          <div className="space-y-1">
            <p className="font-semibold text-sm">{content.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {content.body}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

