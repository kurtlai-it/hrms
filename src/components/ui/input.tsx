import * as React from "react"

import { cn } from "@/lib/utils"
import { mergeRefs, useFieldName } from "@/components/ui/use-field-name"

function Input({ className, type, ref, ...props }: React.ComponentProps<"input">) {
  const own = React.useRef<HTMLInputElement>(null)
  useFieldName(own, Boolean(props["aria-label"] || props["aria-labelledby"]), (el) => el.getAttribute("placeholder") ?? undefined)
  return (
    <input
      ref={mergeRefs(own, ref)}
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-12 w-full min-w-0 rounded-[6px] border-2 bg-transparent px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-dashed",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
