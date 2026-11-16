/**
 * Text settings for Recharts charts drawn without <ChartContainer>: at least
 * 15px and theme colours, so axis ticks, labels and legends are readable in
 * light and dark (muted-foreground and foreground both have 4.5:1 or more on
 * the card). Recharts' own defaults are 12px #666 and series-coloured legends.
 */
import { createElement, type ReactNode } from 'react';

/** Axis tick text. */
export const CHART_TICK = { fontSize: 15, fill: 'hsl(var(--muted-foreground))' } as const;

/** Axis titles and reference-line labels. */
export const CHART_LABEL = { fontSize: 15, fill: 'hsl(var(--foreground))' } as const;

/** <Legend wrapperStyle> */
export const CHART_LEGEND_STYLE = { fontSize: 15 } as const;

/** <Legend formatter>: legend words in the text colour, not the series colour. */
export function chartLegendText(value: ReactNode): ReactNode {
  return createElement('span', { style: { color: 'hsl(var(--foreground))' } }, value);
}

/**
 * Text drawn on or next to a mark: bold, in the text colour with a halo in the
 * card colour, so it reads on any series colour in both themes.
 */
export const CHART_MARK_TEXT = {
  fontSize: 15,
  fontWeight: 700,
  fill: 'hsl(var(--foreground))',
  stroke: 'hsl(var(--card))',
  strokeWidth: 4,
  paintOrder: 'stroke',
  strokeLinejoin: 'round',
} as const;

interface MarkBox { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number; value?: unknown }
const num = (v: unknown) => Number(v ?? 0);

/**
 * <LabelList content>: the series name written up its tallest bar, so each
 * series is named on the mark, not only in the legend. Left out when that bar
 * is too short for the word (the legend still names it). Card-coloured text:
 * 4.5:1 or more on every series colour in both themes (check-contrast).
 */
export function barNameLabel(name: string, values: number[]) {
  const at = values.indexOf(Math.max(...values));
  return function BarName(props: object) {
    const p = props as MarkBox;
    if (p.index !== at) return null;
    const w = num(p.width), h = Math.abs(num(p.height));
    if (w < 16 || h < name.length * 9 + 12) return null;
    const cx = num(p.x) + w / 2, cy = num(p.y) + num(p.height) / 2;
    return createElement('text', { x: cx, y: cy, transform: `rotate(-90 ${cx} ${cy})`, textAnchor: 'middle', dominantBaseline: 'central', fontSize: 15, fontWeight: 700, fill: 'hsl(var(--card))' }, name);
  };
}

/** <LabelList content>: the series name next to the last point of a line. */
export function lineEndLabel(name: string, count: number) {
  return function LineEnd(props: object) {
    const p = props as MarkBox;
    if (p.index !== count - 1) return null;
    return createElement('text', { x: num(p.x) - 6, y: num(p.y) - 12, textAnchor: 'end', ...CHART_MARK_TEXT }, name);
  };
}

/** <LabelList content>: the value above a bar or point (or right of a horizontal bar). */
export function valueLabel(format: (v: number) => string = String, side: 'top' | 'right' = 'top') {
  return function Value(props: object) {
    const p = props as MarkBox;
    if (p.value === null || p.value === undefined) return null;
    const text = format(Number(p.value));
    return side === 'right'
      ? createElement('text', { x: num(p.x) + num(p.width) + 6, y: num(p.y) + num(p.height) / 2, dominantBaseline: 'central', ...CHART_MARK_TEXT }, text)
      : createElement('text', { x: num(p.x) + num(p.width) / 2, y: num(p.y) - 8, textAnchor: 'middle', ...CHART_MARK_TEXT }, text);
  };
}

/** <Pie label>: each slice's share on a small card-coloured label on the slice (small slices left out). */
export function pieValueLabel(props: object) {
  const p = props as { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number };
  // An empty group, not null: on null Recharts draws its own label instead.
  if (!(p.percent >= 0.06)) return createElement('g');
  const r = (p.innerRadius + p.outerRadius) / 2;
  const a = (-p.midAngle * Math.PI) / 180;
  const x = p.cx + r * Math.cos(a), y = p.cy + r * Math.sin(a);
  const text = `${Math.round(p.percent * 100)}%`;
  const w = text.length * 9.5 + 10;
  // Room along the slice at the label's radius (and across the ring).
  if (p.percent * 2 * Math.PI * r < w + 6 || p.outerRadius - p.innerRadius < 26) return createElement('g');
  return createElement('g', { 'aria-hidden': true },
    createElement('rect', { x: x - w / 2, y: y - 12, width: w, height: 24, rx: 4, fill: 'hsl(var(--card))' }),
    createElement('text', { x, y, textAnchor: 'middle', dominantBaseline: 'central', fontSize: 15, fontWeight: 700, fill: 'hsl(var(--foreground))' }, text));
}
