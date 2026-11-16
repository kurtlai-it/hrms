import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Where a person is in a multi-step form, in words: done steps carry a tick,
 * the current step is bold and underlined, later steps are plain. No numbered
 * circles.
 */
export function StepList({ steps, current, label = "Steps", className }: {
  steps: string[]
  /** Index of the current step (0-based). */
  current: number
  label?: string
  className?: string
}) {
  return (
    <ol aria-label={label} className={cn("flex flex-wrap items-end gap-x-5 gap-y-1 border-b-2 border-border", className)}>
      {steps.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={cn(
            "-mb-[2px] flex min-h-10 items-center gap-1.5 border-b-[3px] border-transparent text-base",
            i === current && "border-primary font-bold text-foreground",
            i < current && "text-foreground",
            i > current && "text-muted-foreground",
          )}
        >
          {i < current && <Check aria-hidden className="size-5 text-success" />}
          <span>{s}</span>
          {i < current && <span className="sr-only">(done)</span>}
        </li>
      ))}
    </ol>
  )
}
