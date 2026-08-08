import type { CSSProperties } from "react"

/** Pass CSS custom properties through React's typed style prop. */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties
}
