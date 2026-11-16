// Contrast probes for what axe cannot decide (its "incomplete" items: text on
// SVG / gradients / overlapping layers, very short text) and for chart marks.
// Used by scripts/ui-check.mjs. Everything is measured on the rendered page.
//
// probeText(page, elements): for each element, the text colour (CSS `color`,
//   or `fill` for SVG text) is compared with the real pixels behind it: the
//   text is made transparent, that box is screenshotted, and every colour
//   covering >= 10% of the middle of the box counts as background. Needs 4.5:1 (3:1 for
//   large text: >= 24px, or >= 18.66px bold).
// probeMarks(page): every visible chart mark (Recharts bars, lines, areas,
//   pie slices, gridlines, reference lines) and org-chart edge must have 3:1
//   against the chart's background.

const PROBE_ATTR = 'data-contrast-probe';

/** WCAG contrast of two [r, g, b] (0-255) colours. */
export function ratio(a, b) {
  const lum = ([r, g, bl]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex = ([r, g, b]) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/**
 * Probe text elements. `elements` is an array of Playwright ElementHandles or
 * CSS selectors (axe targets). Returns rows { label, fg, bg, ratio, min, ok, box }.
 */
export async function probeText(page, elements) {
  const rows = [];
  for (const el of elements) {
    const handle = typeof el === 'string' ? await page.$(el) : el;
    if (!handle) continue;
    const info = await handle.evaluate((node, attr) => {
      const isSvgText = node instanceof SVGElement;
      const cs = getComputedStyle(node);
      const parse = (v) => {
        const m = v.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
      };
      const fg = parse(isSvgText ? cs.fill : cs.color);
      const r = node.getBoundingClientRect();
      if (!fg || r.width < 1 || r.height < 1 || cs.visibility === 'hidden') return null;
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      // Hide the text only (backgrounds stay): this element and its descendants.
      node.setAttribute(attr, '');
      return {
        fg: fg.rgb,
        fgAlpha: fg.a * (isSvgText ? Number(cs.fillOpacity || 1) : 1),
        large: size >= 24 || (size >= 18.66 && bold),
        box: { x: r.x, y: r.y, width: r.width, height: r.height },
        label: (node.textContent || '').trim().slice(0, 40),
      };
    }, PROBE_ATTR);
    if (!info) continue;
    await page.evaluate((attr) => {
      if (!document.getElementById('contrast-probe-style')) {
        const style = document.createElement('style');
        style.id = 'contrast-probe-style';
        style.textContent = `[${attr}], [${attr}] * { color: transparent !important; fill: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }`;
        document.head.appendChild(style);
      }
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, PROBE_ATTR);
    const vp = page.viewportSize();
    const clip = {
      x: Math.max(0, info.box.x),
      y: Math.max(0, info.box.y),
      width: Math.max(1, Math.min(info.box.width, vp.width - Math.max(0, info.box.x))),
      height: Math.max(1, Math.min(info.box.height, vp.height - Math.max(0, info.box.y))),
    };
    let bgColours = [];
    if (clip.y < vp.height && clip.x < vp.width) {
      const png = await page.screenshot({ clip, animations: 'disabled' });
      bgColours = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const counts = new Map();
        // Only the middle 60% of the box (where the text sits): rounded corners
        // and the edges of neighbouring elements are not its background.
        const x0 = Math.floor(c.width * 0.2), x1 = Math.ceil(c.width * 0.8);
        const y0 = Math.floor(c.height * 0.2), y1 = Math.ceil(c.height * 0.8);
        let total = 0;
        for (let i = 0; i < d.length; i += 4) {
          const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
          if (px < x0 || px >= x1 || py < y0 || py >= y1) continue;
          total++;
          const key = `${d[i] >> 2},${d[i + 1] >> 2},${d[i + 2] >> 2}`;
          const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          e.n++;
          e.r += d[i];
          e.g += d[i + 1];
          e.b += d[i + 2];
          counts.set(key, e);
        }
        return [...counts.values()]
          .filter((e) => e.n / total >= 0.1)
          .map((e) => ({ rgb: [e.r / e.n, e.g / e.n, e.b / e.n], share: e.n / total }));
      }, png.toString('base64'));
    }
    await handle.evaluate((node, attr) => node.removeAttribute(attr), PROBE_ATTR);
    if (!bgColours.length) continue;
    // Text drawn with alpha is blended over the main background first.
    const main = bgColours.sort((a, b) => b.share - a.share)[0].rgb;
    const fg = info.fg.map((c, i) => c * info.fgAlpha + main[i] * (1 - info.fgAlpha));
    const worst = bgColours.map((b) => ({ bg: b.rgb, r: ratio(fg, b.rgb) })).sort((a, b) => a.r - b.r)[0];
    const min = info.large ? 3 : 4.5;
    rows.push({
      label: info.label,
      fg: hex(fg),
      bg: hex(worst.bg),
      ratio: Math.round(worst.r * 100) / 100,
      min,
      ok: worst.r >= min,
      box: info.box,
    });
  }
  return rows;
}

/**
 * Chart marks and org-chart edges against their chart background (3:1).
 * Returns rows { kind, colour, bg, ratio, ok }; identical rows are merged with
 * a count.
 */
export async function probeMarks(page) {
  return page.evaluate(() => {
    const parse = (v) => {
      const m = v && v.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ([r, g, b]) => {
      const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const hex = (c) => `#${c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
    /** First opaque background colour up the HTML ancestors. */
    const bgOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        if (n instanceof SVGElement) continue;
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.9) return c.rgb;
      }
      return parse(getComputedStyle(document.body).backgroundColor)?.rgb ?? [255, 255, 255];
    };
    const KINDS = [
      ['bar', '.recharts-bar-rectangle path, .recharts-bar-rectangle rect', 'fill'],
      ['line', '.recharts-line-curve', 'stroke'],
      ['area edge', '.recharts-area-curve', 'stroke'],
      ['pie slice', '.recharts-pie-sector path', 'fill'],
      ['gridline', '.recharts-cartesian-grid line, .recharts-polar-grid line, .recharts-polar-grid path, .recharts-polar-grid polygon', 'stroke'],
      ['reference line', '.recharts-reference-line line', 'stroke'],
      ['radar', '.recharts-radar-polygon path', 'stroke'],
      ['org edge', '.react-flow__edge-path', 'stroke'],
    ];
    const merged = new Map();
    for (const [kind, sel, prop] of KINDS) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const c = parse(prop === 'fill' ? cs.fill : cs.stroke);
        if (!c || c.a === 0) continue;
        const opacity = Number(prop === 'fill' ? cs.fillOpacity : cs.strokeOpacity) * Number(cs.opacity);
        if (opacity === 0) continue;
        const bg = bgOf(el);
        const a = c.a * opacity;
        const fg = c.rgb.map((x, i) => x * a + bg[i] * (1 - a));
        const rt = Math.round(ratio(fg, bg) * 100) / 100;
        const key = `${kind}|${hex(fg)}|${hex(bg)}`;
        const row = merged.get(key) ?? { kind, colour: hex(fg), bg: hex(bg), ratio: rt, ok: rt >= 3, count: 0 };
        row.count++;
        merged.set(key, row);
      }
    }
    return [...merged.values()];
  });
}
