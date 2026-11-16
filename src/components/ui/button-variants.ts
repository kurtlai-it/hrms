import { cva } from "class-variance-authority"

/**
 * Class-variance map for <Button /> — split out of button.tsx so the
 * component module exports only components (react-refresh/only-export-components).
 * Imported by button.tsx and the ui siblings that style buttons
 * (alert-dialog, calendar, pagination).
 *
 * Every size is at least 48px tall/wide (older users, see docs/design/DESIGN.md).
 * Focus is the global amber outline in index.css, so no ring classes here.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-normal text-center rounded-[6px] text-sm font-bold transition-all disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:border-2 disabled:border-dashed disabled:border-input disabled:shadow-none [&:disabled_svg]:text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 min-w-0 [&_svg]:shrink-0 aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The ONE main action of a page or section: amber, ink text, and a 2px
        // dark-amber edge (amber alone is 1.88:1 on white).
        default: "border-2 border-cta-border bg-cta text-cta-foreground hover:bg-cta/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-2 border-primary bg-card text-primary hover:bg-accent",
        secondary:
          "border-2 border-primary bg-card text-primary hover:bg-accent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // min-h, not a fixed height: at Bigger text a long label wraps onto a second line.
        default: "h-auto min-h-12 px-5 py-2 has-[>svg]:px-4",
        sm: "h-auto min-h-12 gap-1.5 px-3 py-1.5 has-[>svg]:px-2.5",
        lg: "h-auto min-h-14 px-6 py-2 has-[>svg]:px-5",
        icon: "size-12 shrink-0 min-h-[48px] min-w-[48px]",
        "icon-sm": "size-12 shrink-0 min-h-[48px] min-w-[48px]",
        "icon-lg": "size-14 shrink-0 min-h-[48px] min-w-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export { buttonVariants }
