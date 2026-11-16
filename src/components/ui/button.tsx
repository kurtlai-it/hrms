import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-variants"

/**
 * A disabled button says why next to it (older users, docs/design/DESIGN.md):
 * `disabledReason` text, or "Not available" when none is given. Pass
 * `disabledReason={false}` while the button is only busy (saving, exporting)
 * and its label already says so. The reason is linked with aria-describedby.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  disabledReason,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    disabledReason?: string | false
  }) {
  const { t } = useTranslation()
  const reasonId = React.useId()
  const Comp = asChild ? Slot : "button"
  const showReason = Boolean(props.disabled) && disabledReason !== false && !asChild

  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      aria-describedby={showReason ? cn(props["aria-describedby"], reasonId) : props["aria-describedby"]}
    />
  )
  if (!showReason) return button
  return (
    <>
      {button}
      <span id={reasonId} data-slot="button-disabled-reason" className="self-center px-1.5 text-sm text-muted-foreground">
        {disabledReason || t("common.notAvailable")}
      </span>
    </>
  )
}

export { Button }
