import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

/**
 * Recharts theming helper.
 *
 * Resolves design-system tokens from CSS custom properties defined on
 * `<html>` (`--chart-1..--chart-6`, `--border`, `--text-muted`, `--surface`,
 * `--text`) so chart colors automatically follow the active light/dark
 * theme without hardcoding hex values inside chart components.
 *
 * `next-themes` is not installed yet, so instead of subscribing to
 * `useTheme().resolvedTheme` this re-reads the CSS vars whenever the
 * `class` attribute on `<html>` changes, via a `MutationObserver`.
 */

export interface ChartTheme {
  /** Grid line color for recharts <CartesianGrid stroke> */
  grid: string
  /** Axis line/tick color for recharts <XAxis>/<YAxis> stroke */
  axis: string
  /** Ready-to-spread contentStyle object for recharts <Tooltip> */
  tooltip: CSSProperties
  /** Ordered series color palette (--chart-1..--chart-6) */
  series: string[]
}

interface ChartThemeColors {
  grid: string
  axis: string
  surface: string
  border: string
  text: string
  series: string[]
}

const FALLBACK_SERIES = [
  "#2563eb",
  "#22d3ee",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
]

const FALLBACK_COLORS: ChartThemeColors = {
  grid: "#e7e5e4",
  axis: "#78716c",
  surface: "#ffffff",
  border: "#e7e5e4",
  text: "#1c1917",
  series: FALLBACK_SERIES,
}

function readCssVar(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string
): string {
  const value = styles.getPropertyValue(name).trim()
  return value.length > 0 ? value : fallback
}

/** Reads current theme colors from `document.documentElement`. SSR-safe: falls back when `document` is unavailable. */
function readThemeColors(): ChartThemeColors {
  if (typeof document === "undefined") {
    return FALLBACK_COLORS
  }

  const styles = getComputedStyle(document.documentElement)

  const series = FALLBACK_SERIES.map((fallback, index) =>
    readCssVar(styles, `--chart-${index + 1}`, fallback)
  )

  return {
    grid: readCssVar(styles, "--border", FALLBACK_COLORS.grid),
    axis: readCssVar(styles, "--text-muted", FALLBACK_COLORS.axis),
    surface: readCssVar(styles, "--surface", FALLBACK_COLORS.surface),
    border: readCssVar(styles, "--border", FALLBACK_COLORS.border),
    text: readCssVar(styles, "--text", FALLBACK_COLORS.text),
    series,
  }
}

/**
 * Builds a recharts `<Tooltip contentStyle={...} />` object from resolved
 * theme colors: background `--surface`, `1px solid --border`, 12px radius,
 * `--text` foreground.
 */
export function chartTooltipStyle(
  theme: Pick<ChartThemeColors, "surface" | "border" | "text">
): CSSProperties {
  return {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    color: theme.text,
  }
}

/**
 * Shared prop bundle for recharts `<XAxis>` / `<YAxis>`, spread directly:
 * `<XAxis {...chartAxisProps(theme.axis)} />`
 */
export function chartAxisProps(axis: string): {
  stroke: string
  fontSize: number
  tickLine: false
  axisLine: { stroke: string }
} {
  return {
    stroke: axis,
    fontSize: 12,
    tickLine: false,
    axisLine: { stroke: axis },
  }
}

function toChartTheme(colors: ChartThemeColors): ChartTheme {
  return {
    grid: colors.grid,
    axis: colors.axis,
    tooltip: chartTooltipStyle(colors),
    series: colors.series,
  }
}

/**
 * Returns recharts-ready theme tokens resolved from CSS custom properties.
 * Initializes with SSR-safe fallbacks, reads the real values on mount, and
 * re-reads whenever `<html>`'s `class` attribute changes (theme toggle).
 */
export function useChartTheme(): ChartTheme {
  const [colors, setColors] = useState<ChartThemeColors>(FALLBACK_COLORS)

  useEffect(() => {
    setColors(readThemeColors())

    if (
      typeof document === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return
    }

    const observer = new MutationObserver(() => {
      setColors(readThemeColors())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  return toChartTheme(colors)
}
