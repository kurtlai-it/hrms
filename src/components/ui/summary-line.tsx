import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface SummaryItem {
  label: string
  value: ReactNode
  /** A short note under the value ("6 claims this month"). */
  hint?: ReactNode
}

/**
 * A page's figures as one plain line: the label, the value under it and a
 * short note, between two rules. No boxes and no corner icons. The page's key
 * number is also said in a sentence next to its main action.
 */
export function SummaryLine({ items, className }: { items: SummaryItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-x-8 gap-y-4 border-y py-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-[1.35rem] leading-tight font-bold tabular-nums">{item.value}</dd>
          {item.hint && <dd className="text-muted-foreground">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
