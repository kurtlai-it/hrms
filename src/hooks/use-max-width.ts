import * as React from "react"

/** True while the window is at most `px` wide (follows resizes and rotation). */
export function useMaxWidth(px: number): boolean {
  const query = `(max-width: ${px}px)`
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
