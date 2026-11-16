import * as React from "react"

import { cn } from "@/lib/utils"
import { mergeRefs, useFieldName } from "@/components/ui/use-field-name"

function Textarea({ className, ref, ...props }: React.ComponentProps<"textarea">) {
  const own = React.useRef<HTMLTextAreaElement>(null)
  useFieldName(own, Boolean(props["aria-label"] || props["aria-labelledby"]), (el) => el.getAttribute("placeholder") ?? undefined)
  return (
    <textarea
      ref={mergeRefs(own, ref)}
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-[6px] border-2 bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-dashed",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
