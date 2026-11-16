"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "text-muted-foreground inline-flex h-auto min-h-12 w-fit flex-wrap items-end justify-start gap-1 border-b-2 border-border",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const own = React.useRef<HTMLButtonElement>(null)
  // Filter tabs have no panel: drop aria-controls when it points at nothing.
  React.useEffect(() => {
    const el = own.current
    const id = el?.getAttribute("aria-controls")
    if (el && id && !document.getElementById(id)) el.removeAttribute("aria-controls")
  })
  return (
    <TabsPrimitive.Trigger
      ref={(node) => {
        own.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground -mb-[2px] inline-flex min-h-12 flex-auto items-center justify-center gap-1.5 rounded-none border-b-[3px] border-transparent px-3 py-1 text-center text-sm font-medium whitespace-normal transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground data-[state=active]:border-primary data-[state=active]:font-bold [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
