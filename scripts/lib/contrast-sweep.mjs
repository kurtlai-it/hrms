// Page sweep for scripts/ui-check.mjs (docs/design/DESIGN.md rules).
//
// contrastSweep(): every route (Admin) and Home for every other role, light
//   and dark, 1440px and 390px, Normal and Bigger text. On each page, then on
//   each tab and in the page's main dialog or sheet: controls under 48px, axe
//   (all rules), axe color-contrast, every axe "incomplete" item measured
//   with probeText, every chart mark with probeMarks, and text cut with "…".
//   At 1440px Normal each incomplete item is listed with a screenshot crop
//   (outDir/incomplete/). Env overrides for quicker runs: SWEEP_THEMES=light,
//   SWEEP_WIDTHS=1440, SWEEP_SIZES=normal, SWEEP_ROUTES=/leave,/claims.
// forcedColorsCheck(): Windows high-contrast emulation (forced-colors: active)
//   on a page: every control keeps a visible border, and the focus outline is
//   visible on the first focusable elements.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { probeMarks, probeText } from './contrast-probe.mjs';

const envList = (name, all) => (process.env[name] ? process.env[name].split(',').map((x) => x.trim()) : all);
export const SWEEP_THEMES = envList('SWEEP_THEMES', ['light', 'dark']);
export const SWEEP_SIZES = envList('SWEEP_SIZES', ['normal', 'bigger']);
export const SWEEP_WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
].filter((w) => envList('SWEEP_WIDTHS', ['1440', '390']).includes(String(w.width)));
// The button that opens a page's main dialog or sheet ("Add employee",
// "New claim", "Apply for leave", ...).
const OPENER = /^(add|new|create|initiate|start onboarding|run payroll|manage shifts|open report|request|record|invite|generate link|upload|assign)\b/i;

const slug = (s) => s.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * Size of every input, select, tab, button and checkbox/radio/switch row in
 * `scope` (checkbox marks are measured by their clickable row). The org
 * chart's own React Flow buttons (zoom, collapse toggles) are marked
 * `chart: true`: they scale with the chart and full-size buttons cover them.
 */
export async function controlSizes(page, scope = 'main') {
  return page.evaluate((scopeSel) => {
    const out = [];
    const seen = new Set();
    const kindOf = (el) => {
      const role = el.getAttribute('role');
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (role === 'checkbox' || role === 'radio' || role === 'switch' || type === 'checkbox' || type === 'radio') return 'mark';
      if (role === 'tab') return 'tab';
      if (el.tagName === 'SELECT' || el.dataset.slot === 'select-trigger' || role === 'combobox') return 'select';
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return 'input';
      return 'button';
    };
    const parts = ['input:not([type="hidden"])', 'textarea', 'select', 'button', '[role="tab"]', '[role="combobox"]', '[role="checkbox"]', '[role="switch"]', 'a[data-slot="button"]'];
    const sel = scopeSel.split(',').flatMap((sc) => parts.map((p) => `${sc.trim()} ${p}`)).join(', ');
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden' || el.closest('.sr-only')) continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName)
        .replace(/\s+/g, ' ').trim().slice(0, 40);
      const kind = kindOf(el);
      const chart = Boolean(el.closest('.react-flow'));
      if (kind === 'mark') {
        const row = el.closest('label, [data-choice-row]')
          ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
        const rowHeight = row ? Math.max(row.getBoundingClientRect().height, r.height) : r.height;
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.dataset.disabled !== undefined;
        out.push({ kind, height: Math.round(rowHeight * 10) / 10, label: `${label}${row ? '' : ' [no label]'}`, disabled, chart });
        continue;
      }
      out.push({ kind, height: Math.round(r.height * 10) / 10, label, chart });
    }
    return out;
  }, scope);
}

/**
 * One page state: controls under 48px, axe (all rules), axe color-contrast
 * (scoped to the open dialog if any), probe the incomplete items, check the
 * chart marks, text cut with "…". Prints one line, plus every failure; with
 * `crops` also every incomplete item and its crop file.
 */
export async function checkState(page, ctx, label, { dialog = false, crops = null } = {}) {
  const scope = dialog ? '[role="dialog"], [role="alertdialog"]' : 'main';
  const sizes = await controlSizes(page, scope);
  const small = sizes.filter((c) => c.height < 48 && !(c.kind === 'mark' && c.disabled) && !c.chart);
  const chartSmall = sizes.filter((c) => c.height < 48 && c.chart);
  let all = new AxeBuilder({ page }).disableRules(['color-contrast']);
  if (dialog) all = all.include(scope);
  const axeAll = (await all.analyze()).violations;
  // Cut text: an ellipsis, or text that spills out of its card (or out of the
  // page sideways), so part of it is covered or off screen. Charts and the org
  // chart canvas are left out (they pan and zoom).
  const cut = await page.evaluate((sc) => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll(sc.split(',').map((x) => `${x.trim()} *`).join(', '))) {
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) { out.push(el.textContent.trim().slice(0, 40)); continue; }
      if (el.closest('svg, .react-flow, [data-slot="table-container"], .overflow-x-auto, .sr-only, input, textarea, select, option')) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!text.length || el.getBoundingClientRect().width === 0) continue;
      if (cs.display !== 'inline' && cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1) {
        out.push(`${el.textContent.trim().slice(0, 40)} (wider than its box)`);
        continue;
      }
      const range = document.createRange();
      const rects = text.flatMap((n) => { range.selectNodeContents(n); return [...range.getClientRects()]; }).filter((q) => q.width > 0);
      if (!rects.length) continue;
      const r = { left: Math.min(...rects.map((q) => q.left)), right: Math.max(...rects.map((q) => q.right)) };
      const box = el.parentElement?.closest('[data-slot="card"], [role="dialog"], [role="alertdialog"]');
      const b = box ? box.getBoundingClientRect() : { left: 0, right: vw };
      if (r.right > Math.min(b.right, vw) + 1 || r.left < Math.max(b.left, 0) - 1) out.push(`${el.textContent.trim().slice(0, 40)} (spills)`);
    }
    return out;
  }, scope);
  ctx.summary.under48 = (ctx.summary.under48 ?? 0) + small.length;
  ctx.summary.chartToggles = (ctx.summary.chartToggles ?? 0) + chartSmall.length;
  ctx.summary.axeAll = (ctx.summary.axeAll ?? 0) + axeAll.length;
  ctx.summary.cut = (ctx.summary.cut ?? 0) + cut.length;
  let builder = new AxeBuilder({ page }).withRules(['color-contrast']);
  if (dialog) builder = builder.include('[role="dialog"], [role="alertdialog"]');
  const res = await builder.analyze();
  const violations = res.violations.flatMap((v) => v.nodes);
  const incomplete = res.incomplete.flatMap((v) => v.nodes);
  const rows = [];
  let n = 0;
  for (const node of incomplete) {
    const h = await page.$(node.target[0]);
    if (!h) continue;
    // Centre it: at the edges it can sit under the sticky top bar or the phone bottom bar.
    await h.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
    const [row] = await probeText(page, [h]);
    if (!row) continue;
    if (crops) {
      const vp = page.viewportSize();
      const pad = 12;
      const x = Math.max(0, row.box.x - pad);
      const y = Math.max(0, row.box.y - pad);
      const file = join(crops.dir, `${crops.prefix}-${String(++n).padStart(2, '0')}.png`);
      await page
        .screenshot({ path: file, clip: { x, y, width: Math.min(vp.width - x, row.box.width + 2 * pad), height: Math.min(vp.height - y, row.box.height + 2 * pad) } })
        .catch(() => {});
      row.crop = file;
    }
    rows.push(row);
  }
  const marks = dialog ? [] : await probeMarks(page);
  const textFails = rows.filter((r) => !r.ok);
  const markFails = marks.filter((m) => !m.ok);
  const markCount = marks.reduce((s, m) => s + m.count, 0);
  ctx.summary.states++;
  ctx.summary.axe += violations.length;
  ctx.summary.incomplete += rows.length;
  ctx.summary.probeFail += textFails.length;
  ctx.summary.marks += markCount;
  ctx.summary.markFail += markFails.length;
  const lowest = rows.length ? `, lowest ${Math.min(...rows.map((r) => r.ratio))}:1` : '';
  console.log(
    `  ${label.padEnd(50)} <48px ${small.length}  axe(all) ${axeAll.length}  cut ${cut.length}  contrast ${violations.length}  incomplete ${rows.length} (under ${textFails.length}${lowest})  chart marks ${markCount} (under ${markFails.length})`,
  );
  for (const c of small) console.log(`      UNDER 48 ${c.height}px ${c.kind} ${c.label}`);
  for (const v of axeAll) console.log(`      AXE-ALL ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ').slice(0, 100)}`);
  for (const c of cut) console.log(`      CUT "${c}"`);
  for (const v of violations) {
    const d = v.any[0]?.data ?? {};
    console.log(`      AXE ${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}:1  ${v.target.join(' ').slice(0, 100)}`);
  }
  for (const r of crops ? rows : textFails) {
    console.log(`      ${r.ok ? 'ok  ' : 'FAIL'} ${String(r.ratio).padStart(5)}:1 (min ${r.min})  "${r.label}"  ${r.fg} on ${r.bg}${r.crop ? `  ${r.crop}` : ''}`);
  }
  for (const m of markFails) console.log(`      MARK ${m.ratio}:1 < 3  ${m.kind} ${m.colour} on ${m.bg} (x${m.count})`);
}

/** Tab names in the page's main area (first tab list), visible ones only. */
async function tabNames(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('main [role="tablist"]')]
      .slice(0, 1)
      .flatMap((list) => [...list.querySelectorAll('[role="tab"]')])
      .filter((t) => t.getBoundingClientRect().width > 0)
      .map((t) => t.textContent.trim()),
  );
}

/** Open the page's main dialog/sheet; returns its opener text or null. */
async function openMainDialog(page) {
  const buttons = page.locator('main button:visible:not([disabled])');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const text = ((await buttons.nth(i).innerText().catch(() => '')) || '').trim();
    if (!OPENER.test(text)) continue;
    await buttons.nth(i).click().catch(() => {});
    const opened = await page
      .locator('[role="dialog"], [role="alertdialog"]')
      .first()
      .waitFor({ timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return text;
    return null;
  }
  return null;
}

/**
 * Run the sweep. `login(page, account)` signs in; `admin` is the ui-check
 * Admin entry, `others` the other roles (Home only); `routes` are the
 * NAV_ITEMS paths (SWEEP_ROUTES overrides them).
 */
export async function contrastSweep({ browser, base, outDir, login, admin, others, routes: allRoutes }) {
  const routes = envList('SWEEP_ROUTES', allRoutes);
  const cropDir = join(outDir, 'incomplete');
  mkdirSync(cropDir, { recursive: true });
  const ctx = { summary: { states: 0, axe: 0, incomplete: 0, probeFail: 0, marks: 0, markFail: 0, tabs: 0, dialogs: 0, under48: 0, chartToggles: 0, axeAll: 0, cut: 0 } };
  for (const theme of SWEEP_THEMES) {
    for (const vp of SWEEP_WIDTHS) {
      for (const size of SWEEP_SIZES) {
        const combo = `${theme} ${vp.width} ${size}`;
        console.log(`\n=== Sweep: ${combo}`);
        const crops = vp.width === 1440 && size === 'normal';
        const context = await browser.newContext({ viewport: vp });
        const page = await context.newPage();
        await page.addInitScript(
          ([t, s]) => {
            localStorage.setItem('myhrms:theme', t);
            localStorage.setItem('myhrms:textSize', s);
          },
          [theme, size],
        );
        await login(page, admin);
        for (const route of routes) {
          await page.goto(`${base}${route}`);
          await page.locator('h1').first().waitFor({ timeout: 20000 }).catch(() => {});
          await settle(page);
          const prefix = `${theme}-${vp.width}-${slug(route)}`;
          await checkState(page, ctx, `${route}`, { crops: crops ? { dir: cropDir, prefix } : null });
          const tabs = await tabNames(page);
          for (const [i, name] of tabs.entries()) {
            if (i === 0) continue; // the first tab is the page view above
            const tab = page.locator('main [role="tablist"]').first().getByRole('tab', { name, exact: true });
            if (!(await tab.isVisible().catch(() => false))) continue;
            await tab.click().catch(() => {});
            await settle(page);
            ctx.summary.tabs++;
            await checkState(page, ctx, `${route}  tab "${name}"`, {
              crops: crops ? { dir: cropDir, prefix: `${prefix}-tab-${slug(name)}` } : null,
            });
          }
          if (tabs.length > 1) {
            await page.goto(`${base}${route}`);
            await settle(page);
          }
          const opener = await openMainDialog(page);
          if (opener) {
            await page.waitForTimeout(400);
            ctx.summary.dialogs++;
            await checkState(page, ctx, `${route}  dialog "${opener}"`, {
              dialog: true,
              crops: crops ? { dir: cropDir, prefix: `${prefix}-dialog` } : null,
            });
            await page.keyboard.press('Escape');
          }
        }
        await context.close();

        // Home for every other role.
        for (const account of others) {
          const ectx = await browser.newContext({ viewport: vp });
          const epage = await ectx.newPage();
          await epage.addInitScript(
            ([t, s]) => {
              localStorage.setItem('myhrms:theme', t);
              localStorage.setItem('myhrms:textSize', s);
            },
            [theme, size],
          );
          await login(epage, account);
          await settle(epage);
          await checkState(epage, ctx, `/ (${account.role})`, {
            crops: crops ? { dir: cropDir, prefix: `${theme}-${vp.width}-home-${account.role.toLowerCase()}` } : null,
          });
          await ectx.close();
        }
      }
    }
  }
  return ctx.summary;
}

/**
 * Forced-colors (Windows high contrast) check on the current page: controls
 * keep a visible border; the focus outline shows on the first 12 Tab stops.
 */
export async function forcedColorsCheck(page, label, shotPath) {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.waitForTimeout(300);
  const borders = await page.evaluate(() => {
    const sel = 'button, a[data-slot="button"], input:not([type="hidden"]), textarea, select, [role="combobox"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"]';
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden' || el.closest('.sr-only')) continue;
      const cs = getComputedStyle(el);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(
        (s) => cs[`border${s}Style`] !== 'none' && parseFloat(cs[`border${s}Width`]) >= 1,
      );
      out.push({ ok: sides.length === 4, label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 40) });
    }
    return out;
  });
  const focus = [];
  await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {});
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    focus.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          ok: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
          outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`,
          label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40),
        };
      }),
    );
  }
  if (shotPath) await page.screenshot({ path: shotPath, fullPage: true });
  await page.emulateMedia({ forcedColors: 'none' });
  const noBorder = borders.filter((b) => !b.ok);
  const stops = focus.filter(Boolean);
  const noRing = stops.filter((f) => !f.ok);
  console.log(`  ${label}: ${borders.length} controls, ${noBorder.length} without a border; ${stops.length} focus stops, ${noRing.length} without a visible outline${stops[0] ? ` (outline: ${stops[0].outline})` : ''}`);
  for (const b of noBorder.slice(0, 10)) console.log(`      NO BORDER  ${b.label}`);
  for (const f of noRing) console.log(`      NO OUTLINE ${f.label}  (${f.outline})`);
  return { controls: borders.length, noBorder: noBorder.length, stops: stops.length, noRing: noRing.length };
}
