import * as React from "react"

/**
 * Screen readers need a name for every field. When a page gives none (no
 * aria-label, aria-labelledby, <label for> or wrapping <label>), use the
 * nearest <label> before the field in the same block (up to 3 levels up), or
 * the fallback (a select's shown value) as a last resort.
 */
export function useFieldName(
  ref: React.RefObject<HTMLElement | null>,
  named: boolean,
  fallback?: (el: HTMLElement) => string | undefined,
) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || named) return
    if ((el as HTMLInputElement).labels?.length) return
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return
    if (el.getAttribute("aria-labelledby")) return
    let label: HTMLLabelElement | null = null
    for (let node: HTMLElement | null = el.parentElement, depth = 0; node && depth < 3 && !label; node = node.parentElement, depth++) {
      const before = [...node.querySelectorAll("label")].filter(
        (l) => !l.htmlFor && l.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !l.contains(el),
      )
      label = before[before.length - 1] ?? null
    }
    if (label) {
      if (!label.id) label.id = `${el.id || "field"}-label-${Math.random().toString(36).slice(2, 8)}`
      el.setAttribute("aria-labelledby", label.id)
    } else if (!el.getAttribute("aria-label")) {
      const name = fallback?.(el)
      if (name) el.setAttribute("aria-label", name)
    }
  })
}

/** One ref for the component's own use and the caller's ref. */
export function mergeRefs<T>(own: React.RefObject<T | null>, ref: React.Ref<T> | undefined) {
  return (node: T | null) => {
    own.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) (ref as React.RefObject<T | null>).current = node
  }
}
