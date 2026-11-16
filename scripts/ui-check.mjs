// Browser self-check for the simple navigation (docs/design/DESIGN.md).
// Needs the dev server running (npm run dev → http://localhost:3000) and
// Microsoft Edge (playwright-core drives the installed browser; nothing is
// downloaded).
//
// Usage: node scripts/ui-check.mjs [outDir]   (default: <os tmp>/shots)
//   BASE_URL=http://localhost:3000 by default.
//
// Prints, per role (Admin, HR, Manager, Employee) at 1440px and 390px:
// the big-button labels, the top bar colour, every button/link height in the
// top bar, Home and a group page (flags < 48px), axe violations on Home and a
// group page, labels that wrap onto more than 2 lines (BM / 中文 at 390px),
// and table checks for Employees and a Payroll run at 1440px. Then the
// contrast sweep (scripts/lib/contrast-sweep.mjs): every route as Admin and
// Home as Employee, light and dark, 1440 and 390, Normal and Bigger text,
// with each tab and the main dialog; axe color-contrast, axe "incomplete"
// items measured on the real pixels (crops in outDir/incomplete), chart marks
// at 3:1; and a forced-colors (Windows high contrast) check on Home, a
// Payroll run and the Apply for leave form. Screenshots go to outDir.
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { AxeBuilder } from '@axe-core/playwright';
import { checkState, contrastSweep, forcedColorsCheck } from './lib/contrast-sweep.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? join(tmpdir(), 'shots');
mkdirSync(OUT, { recursive: true });

const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];
const ROLES = [
  { role: 'Admin', username: 'admin', password: 'admin123' },
  { role: 'HR', username: 'hr', password: 'hr123' },
  { role: 'Manager', username: 'ahmad.faizal', password: 'manager123' },
  // Employee username is read from the seeded account list (emp-05).
  { role: 'Employee', employeeId: 'emp-05', password: 'password123' },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const summary = { under48: 0, axe: 0, wraps: 0, inner: 0, marks: 0, ellipsis: 0 };

async function newPage(viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  return { context, page: await context.newPage() };
}

async function login(page, account) {
  await page.goto(`${BASE}/login`);
  await page.locator('#username').waitFor();
  let username = account.username;
  if (!username) {
    // Employee accounts appear once the tenant's demo data is seeded, which
    // happens on the first Admin login: log in as Admin, sign out, continue.
    await login(page, ROLES[0]);
    await page.evaluate(() => localStorage.removeItem('hrms.session'));
    await page.goto(`${BASE}/login`);
    await page.locator('#username').waitFor();
    // Employee accounts are created once the demo tenants finish seeding.
    const handle = await page.waitForFunction((empId) => {
      const users = JSON.parse(localStorage.getItem('hrms.users') ?? '[]');
      return users.find((u) => u.role === 'Employee' && u.employeeId === empId && u.companyId === 'co-asm')?.username ?? null;
    }, account.employeeId, { timeout: 20000 });
    username = await handle.jsonValue();
    if (!username) throw new Error(`no Employee account for ${account.employeeId}`);
  }
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(account.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.locator('h1').first().waitFor({ timeout: 20000 });
  await page.waitForLoadState('networkidle');
  return username;
}

/** Visible buttons/links/inputs inside the given roots, with their rendered size. */
async function controlHeights(page, rootSelectors) {
  return page.evaluate((roots) => {
    const out = [];
    for (const sel of roots) {
      for (const root of document.querySelectorAll(sel)) {
        for (const el of root.querySelectorAll('button, a, input, select, [role="button"]')) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
          const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName)
            .replace(/\s+/g, ' ').trim().slice(0, 50);
          out.push({ where: sel, label, height: Math.round(r.height * 10) / 10, width: Math.round(r.width) });
        }
      }
    }
    return out;
  }, rootSelectors);
}

/** Number of text lines per control label (text nodes only, icons ignored). */
async function labelLines(page, rootSelectors) {
  return page.evaluate((roots) => {
    const out = [];
    const lines = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const tops = [];
      const range = document.createRange();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        range.selectNodeContents(n);
        for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) tops.push(rect.top);
      }
      tops.sort((a, b) => a - b);
      let count = 0;
      let last = -Infinity;
      for (const t of tops) {
        if (t - last > 6) count++;
        last = t;
      }
      return count;
    };
    for (const sel of roots) {
      for (const root of document.querySelectorAll(sel)) {
        for (const el of root.querySelectorAll('button, a')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // Tiles: count the name only (the description may wrap by design).
          const target = el.querySelector('.text-\\[1\\.25rem\\]') ?? el;
          out.push({ label: target.textContent.replace(/\s+/g, ' ').trim(), lines: lines(target) });
        }
      }
    }
    return out;
  }, rootSelectors);
}

async function tileLabels(page) {
  return page.locator('section[aria-labelledby="home-what"] li a .text-\\[1\\.25rem\\]').allTextContents();
}

async function axe(page, label) {
  const result = await new AxeBuilder({ page }).analyze();
  summary.axe += result.violations.length;
  const detail = result.violations.map((v) => `${v.id}(${v.impact}, ${v.nodes.length})`).join(', ');
  console.log(`  axe ${label}: ${result.violations.length} violation(s)${detail ? ` — ${detail}` : ''}`);
  for (const v of result.violations) {
    for (const n of v.nodes.slice(0, 3)) console.log(`    ${v.id}: ${n.target.join(' ')} — ${n.html.slice(0, 120)}`);
  }
  return result.violations;
}

function printHeights(label, rows) {
  const small = rows.filter((r) => r.height < 48);
  summary.under48 += small.length;
  console.log(`  heights ${label}: ${rows.length} controls, min ${Math.min(...rows.map((r) => r.height))}px, ${small.length} under 48px`);
  for (const r of rows) console.log(`    ${r.height < 48 ? 'UNDER 48' : 'ok      '} ${String(r.height).padStart(5)}px  ${r.where.padEnd(28)} ${r.label}`);
}

const SHELL = ['header', 'nav[aria-label="Main"], nav[aria-label="Utama"], nav[aria-label="主菜单"]'];

// UI_CHECK_SAMPLE=home: only Home for each role and a Payroll run (homeSample).
// UI_CHECK_SAMPLE=sweep: only the page sweep (contrast-sweep.mjs; narrow it
// with SWEEP_THEMES / SWEEP_WIDTHS / SWEEP_SIZES / SWEEP_ROUTES).
if (process.env.UI_CHECK_SAMPLE === 'home') {
  const failures = await homeSample();
  await browser.close();
  process.exit(failures ? 1 : 0);
}
// UI_CHECK_SAMPLE=extra: pages outside NAV_ITEMS: Login, the onboarding form
// (/onboard/:token), a payslip, and the payslip in print mode.
// UI_CHECK_SAMPLE=brand: Home, More and Leave in every seeded tenant colour.
if (process.env.UI_CHECK_SAMPLE === 'brand') {
  const failures = await brandPages();
  await browser.close();
  process.exit(failures ? 1 : 0);
}
if (process.env.UI_CHECK_SAMPLE === 'extra') {
  const failures = await extraPages();
  await browser.close();
  process.exit(failures ? 1 : 0);
}
if (process.env.UI_CHECK_SAMPLE === 'sweep') {
  const navSrc = readFileSync(new URL('../src/components/layout/nav.ts', import.meta.url), 'utf8');
  const navBody = navSrc.slice(navSrc.indexOf('export const NAV_ITEMS'));
  // NAV_ITEMS plus the navigation pages (More, one group page).
  const routes = [...new Set([...navBody.slice(0, navBody.indexOf('];')).matchAll(/path: '([^']+)'/g)].map((m) => m[1]).concat(['/more', '/go/staff']))];
  const sw = await contrastSweep({ browser, base: BASE, outDir: OUT, login, admin: ROLES[0], others: [ROLES[1], ROLES[2], ROLES[3]], routes });
  await browser.close();
  console.log(`\nSUMMARY (sweep): ${sw.states} page states (incl. ${sw.tabs} tabs, ${sw.dialogs} dialogs); controls under 48px ${sw.under48} (org-chart zoom/collapse toggles, scale with the chart: ${sw.chartToggles}); axe (all rules) ${sw.axeAll}; axe color-contrast ${sw.axe}; axe-incomplete probed ${sw.incomplete}, under the minimum ${sw.probeFail}; chart marks ${sw.marks}, under 3:1 ${sw.markFail}; text cut ${sw.cut}`);
  process.exit(sw.under48 + sw.axeAll + sw.axe + sw.probeFail + sw.markFail + sw.cut ? 1 : 0);
}

// ── Per role × width: Home, big-button labels, top bar colour ────────────────
for (const account of ROLES) {
  for (const vp of WIDTHS) {
    const { context, page } = await newPage(vp);
    const username = await login(page, account);
    const tiles = await tileLabels(page);
    const barColour = await page.evaluate(() => getComputedStyle(document.querySelector('header')).backgroundColor);
    const company = await page.locator('header').innerText();
    await page.screenshot({ path: join(OUT, `${account.role.toLowerCase()}-${vp.width}-home.png`), fullPage: true });
    console.log(`\n=== ${account.role} (${username}) @ ${vp.width}px`);
    console.log(`  top bar: ${barColour} | text: ${company.replace(/\s+/g, ' ').trim()}`);
    console.log(`  big buttons (${tiles.length}): ${tiles.join(' | ')}`);

    if (account.role === 'Admin') {
      printHeights(`Home @${vp.width}`, await controlHeights(page, [...SHELL, '#todo', 'section[aria-labelledby="home-what"]']));
      await axe(page, `Home @${vp.width}`);

      await page.goto(`${BASE}/go/time`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.screenshot({ path: join(OUT, `admin-${vp.width}-group-time.png`), fullPage: true });
      printHeights(`group /go/time @${vp.width}`, await controlHeights(page, [...SHELL, 'main']));
      await axe(page, `group /go/time @${vp.width}`);

      await page.goto(`${BASE}/go/staff`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.screenshot({ path: join(OUT, `admin-${vp.width}-group-staff.png`), fullPage: true });

      // Me panel and Help sheet.
      const meButton = vp.width > 640 ? page.locator('header').getByRole('button', { name: 'Me' }) : page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me' });
      await meButton.click();
      await page.getByRole('region', { name: 'Me' }).waitFor();
      await page.screenshot({ path: join(OUT, `admin-${vp.width}-me-panel.png`) });
      printHeights(`Me panel @${vp.width}`, await controlHeights(page, ['#me-panel']));
      await meButton.click();
      await page.locator('header').getByRole('button', { name: 'Help' }).click();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `admin-${vp.width}-help.png`) });
      await page.keyboard.press('Escape');

      // Skip link: first Tab stop.
      await page.goto(`${BASE}/`);
      await page.locator('h1').waitFor();
      await page.keyboard.press('Tab');
      const firstFocus = await page.evaluate(() => {
        const el = document.activeElement;
        return { text: el?.textContent?.trim(), href: el?.getAttribute('href'), height: Math.round(el?.getBoundingClientRect().height ?? 0) };
      });
      console.log(`  first Tab stop: "${firstFocus.text}" → ${firstFocus.href} (${firstFocus.height}px tall when focused)`);
    }
    await context.close();
  }
}

// ── BM and 中文 Home at 390px: labels that wrap onto more than 2 lines ───────
for (const lang of [{ code: 'ms', name: 'Bahasa Melayu' }, { code: 'zh', name: '中文' }]) {
  const { context, page } = await newPage(WIDTHS[1]);
  await login(page, ROLES[0]);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me' }).click();
  await page.getByRole('button', { name: lang.name }).click();
  await page.locator('html[lang]').first().waitFor();
  // Close the panel again with the (now translated) Me button.
  await page.locator('nav[aria-label] button[aria-expanded="true"]').click();
  await page.locator('h1').waitFor();
  await page.screenshot({ path: join(OUT, `admin-390-home-${lang.code}.png`), fullPage: true });
  const rows = await labelLines(page, ['header', '#todo', 'section[aria-labelledby="home-what"]', 'nav[aria-label]']);
  const over = rows.filter((r) => r.lines > 2);
  summary.wraps += over.length;
  console.log(`\n=== Home @390px in ${lang.name}: ${rows.length} labels checked, ${over.length} wrap onto more than 2 lines`);
  for (const r of rows) console.log(`    ${r.lines > 2 ? 'OVER 2  ' : 'ok      '} ${r.lines} line(s)  ${r.label}`);
  await context.close();
}

// ── Tables at 1440px with the 48px small buttons ─────────────────────────────
let runHref = null;
{
  const { context, page } = await newPage(WIDTHS[0]);
  await login(page, ROLES[0]);
  const tableReport = async (label) =>
    page.evaluate((label) => {
      const tables = [...document.querySelectorAll('table')];
      return tables.map((t, i) => {
        const wrap = t.parentElement;
        const buttons = [...t.querySelectorAll('button, a')].map((b) => b.getBoundingClientRect().height).filter((h) => h > 0);
        const rows = [...t.querySelectorAll('tbody tr')].map((r) => r.getBoundingClientRect().height);
        return {
          label,
          table: i + 1,
          tableWidth: Math.round(t.scrollWidth),
          boxWidth: Math.round(wrap.clientWidth),
          overflows: t.scrollWidth > wrap.clientWidth + 1,
          rows: rows.length,
          rowHeight: rows.length ? `${Math.round(Math.min(...rows))}–${Math.round(Math.max(...rows))}px` : '-',
          buttons: buttons.length,
          buttonHeight: buttons.length ? `${Math.round(Math.min(...buttons))}–${Math.round(Math.max(...buttons))}px` : '-',
        };
      });
    }, label);

  await page.goto(`${BASE}/employees`);
  await page.locator('table').first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: join(OUT, 'admin-1440-employees.png'), fullPage: true });
  console.log('\n=== Tables @1440px');
  for (const r of await tableReport('/employees')) console.log(`  ${JSON.stringify(r)}`);

  // The fresh demo company has no payroll run yet. Create this month's run
  // with the app's own engine (the module the dev server already serves,
  // same as the Run payroll wizard's last step), then open its detail page.
  await page.goto(`${BASE}/payroll`);
  await page.locator('h1').first().waitFor();
  const runId = await page.evaluate(async () => {
    const { runPayroll } = await import('/src/lib/payrollEngine.ts');
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return runPayroll(month, undefined, 'Admin').run.id;
  });
  const href = `/payroll/runs/${runId}`;
  runHref = href;
  await page.goto(`${BASE}${href}`);
  await page.locator('table').first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: join(OUT, 'admin-1440-payroll-run.png'), fullPage: true });
  for (const r of await tableReport(href)) console.log(`  ${JSON.stringify(r)}`);
  await context.close();
}

// ── Every NAV_ITEMS route as Admin: inner-page controls under 48px ──────────
// Routes come from src/components/layout/nav.ts so the list stays in sync.
const navSource = readFileSync(new URL('../src/components/layout/nav.ts', import.meta.url), 'utf8');
const navStart = navSource.indexOf('export const NAV_ITEMS');
const navBlock = navSource.slice(navStart, navSource.indexOf('];', navStart));
const ROUTES = [...navBlock.matchAll(/path: '([^']+)'/g)].map((m) => m[1]);

async function innerControls(page) {
  return page.evaluate(() => {
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
    const sel = 'main input:not([type="hidden"]), main textarea, main select, main button, main [role="tab"], main [role="combobox"], main [role="checkbox"], main [role="switch"], main a[data-slot="button"]';
    for (const el of document.querySelectorAll(sel)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName)
        .replace(/\s+/g, ' ').trim().slice(0, 40);
      const kind = kindOf(el);
      if (kind === 'mark') {
        // Checkbox / radio / switch: measure the clickable row — the label that
        // wraps the mark, a label[for] pointing at it, or a data-choice-row area.
        const row = el.closest('label, [data-choice-row]')
          ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
        const rowHeight = row ? Math.max(row.getBoundingClientRect().height, r.height) : r.height;
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.dataset.disabled !== undefined;
        out.push({ kind, height: Math.round(rowHeight * 10) / 10, label: `${label}${row ? '' : ' [no label]'}`, disabled });
        continue;
      }
      out.push({ kind, height: Math.round(r.height * 10) / 10, label });
    }
    return out;
  });
}

for (const vp of WIDTHS) {
  const { context, page } = await newPage(vp);
  await login(page, ROLES[0]);
  console.log(`\n=== Inner pages @${vp.width}px (Admin): controls under 48px`);
  let routeTotal = 0;
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    const rows = await innerControls(page);
    const small = rows.filter((r) => r.height < 48 && r.kind !== 'mark');
    const marks = rows.filter((r) => r.height < 48 && r.kind === 'mark' && !r.disabled);
    const disabledMarks = rows.filter((r) => r.kind === 'mark' && r.disabled).length;
    summary.inner += small.length;
    summary.marks += marks.length;
    routeTotal += rows.length;
    const markRows = rows.filter((r) => r.kind === 'mark' && !r.disabled).length;
    console.log(`  ${route.padEnd(17)} ${String(rows.length).padStart(3)} controls, ${small.length} under 48px; checkbox/radio/switch rows: ${markRows}, ${marks.length} under 48px${disabledMarks ? ` (${disabledMarks} disabled, not targets)` : ''}`);
    for (const r of [...small, ...marks]) console.log(`      UNDER 48 ${String(r.height).padStart(5)}px  ${r.kind === 'mark' ? 'row   ' : r.kind.padEnd(6)} ${r.label}`);
  }
  console.log(`  total controls checked @${vp.width}px: ${routeTotal}`);
  await context.close();
}

// ── Text cut with an ellipsis on Home and Payroll ────────────────────────────
{
  const { context, page } = await newPage(WIDTHS[0]);
  await login(page, ROLES[0]);
  console.log('\n=== Text cut with "…" @1440px');
  for (const route of ['/', '/payroll', runHref].filter(Boolean)) {
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    const cut = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => {
      const cs = getComputedStyle(el);
      const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1;
      return (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || clamped;
    }).map((el) => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)));
    summary.ellipsis += cut.length;
    console.log(`  ${route}: ${cut.length} cut${cut.length ? ` — ${cut.join(' | ')}` : ''}`);
  }
  await context.close();
}

// ── Home per role × width × text size: overflowing text + axe ───────────────
const TEXT_SIZES = ['normal', 'big', 'bigger'];
summary.overflow = 0;
summary.homeAxe = 0;
console.log('\n=== Home at all 3 text sizes (text that overflows its box, axe)');
for (const account of ROLES) {
  for (const vp of WIDTHS) {
    for (const size of TEXT_SIZES) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await context.addInitScript((s) => {
        try { localStorage.setItem('myhrms:textSize', s); } catch { /* ignore */ }
      }, size);
      const page = await context.newPage();
      await login(page, account);
      await page.goto(`${BASE}/`);
      await page.locator('h1').waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `${account.role.toLowerCase()}-${vp.width}-home-${size}.png`), fullPage: true });
      const rootPx = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
      const overflow = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('header *, main *, nav *')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'inline' || cs.display === 'none' || el.closest('svg') || el.classList.contains('sr-only')) continue;
          if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          const wide = el.scrollWidth > el.clientWidth + 1;
          const tall = cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1;
          if (wide || tall) out.push(`${el.tagName.toLowerCase()} "${el.textContent.replace(/\s+/g, ' ').trim().slice(0, 50)}" (${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight})`);
        }
        return out;
      });
      const result = await new AxeBuilder({ page }).analyze();
      summary.overflow += overflow.length;
      summary.homeAxe += result.violations.length;
      console.log(`  ${account.role.padEnd(8)} @${String(vp.width).padEnd(4)} ${size.padEnd(6)} (root ${rootPx}): ${overflow.length} overflowing, axe ${result.violations.length}${result.violations.length ? ` — ${result.violations.map((v) => v.id).join(', ')}` : ''}`);
      for (const o of overflow) console.log(`      OVERFLOW ${o}`);
      await context.close();
    }
  }
}

// ── Payroll run page (Prompt 5): table fit, details, controls, axe, compare ──
summary.payroll = { under48: 0, axe: 0, ellipsis: 0 };
console.log('\n=== Payroll run page');
{
  const designDir = new URL('../docs/design/screenshots/', import.meta.url);
  const toDataUri = (file) => `data:image/png;base64,${readFileSync(new URL(file, designDir)).toString('base64')}`;
  const sideBySide = async (designFile, realPath, outName, width) => {
    const ctx = await browser.newContext({ viewport: { width: width * 2 + 48, height: 900 } });
    const pg = await ctx.newPage();
    const real = `data:image/png;base64,${readFileSync(realPath).toString('base64')}`;
    await pg.setContent(`<body style="margin:0;font:16px sans-serif;display:flex;gap:16px;padding:16px;background:#ddd">
      <figure style="margin:0;width:${width}px"><figcaption><b>Design</b> ${designFile}</figcaption><img src="${toDataUri(designFile)}" style="width:${width}px"></figure>
      <figure style="margin:0;width:${width}px"><figcaption><b>Real page</b></figcaption><img src="${real}" style="width:${width}px"></figure></body>`);
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: join(OUT, outName), fullPage: true });
    await ctx.close();
  };

  for (const vp of WIDTHS) {
    const { context, page } = await newPage(vp);
    await login(page, ROLES[0]);
    await page.goto(`${BASE}/payroll`);
    await page.locator('h1').first().waitFor();
    // A finished run for this month, made with the app's own engine.
    const runId = await page.evaluate(async () => {
      const { runPayroll, finalizePayrollRun } = await import('/src/lib/payrollEngine.ts');
      const now = new Date();
      const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const r = runPayroll(mk, undefined, 'Admin').run;
      if (r.status === 'draft') finalizePayrollRun(r.id, 'Admin');
      return r.id;
    });
    await page.goto(`${BASE}/payroll/runs/${runId}`);
    await page.locator('h1').waitFor();
    await page.waitForTimeout(400);

    const measure = () => page.evaluate(() => {
      const box = document.querySelector('[data-testid="run-table"]');
      const visible = box && getComputedStyle(box).display !== 'none';
      return visible
        ? { table: true, scrollWidth: box.scrollWidth, clientWidth: box.clientWidth, fits: box.scrollWidth <= box.clientWidth + 1 }
        : { table: false, cards: document.querySelectorAll('section[aria-labelledby="run-pay-each"] ul > li').length };
    });
    const status = await page.locator('h1 + span').innerText();
    const off = await measure();
    const simplePath = join(OUT, `payroll-real-${vp.width}-simple.png`);
    await page.screenshot({ path: simplePath, fullPage: true });
    console.log(`  @${vp.width}px status word: "${status.trim()}"`);
    console.log(`  @${vp.width}px details OFF: ${JSON.stringify(off)}`);
    const refundInfo = await page.evaluate(() => ({
      headers: [...document.querySelectorAll('[data-testid="run-table"] thead th')].map((th) => th.textContent.trim()),
      claimsBackCard: [...document.querySelectorAll('main p.font-bold')].some((el) => el.textContent.trim() === 'Claims paid back'),
      cardsWithClaimsLine: [...document.querySelectorAll('section[aria-labelledby="run-pay-each"] ul > li dt')].filter((dt) => dt.textContent.trim() === 'Claims paid back').length,
    }));
    console.log(`  @${vp.width}px refunds: ${JSON.stringify(refundInfo)}`);
    const totalBoxes = await page.evaluate(() => [...document.querySelectorAll('main p.text-\\[1\\.6rem\\]')].map((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      const box = el.parentElement;
      return {
        label: box.querySelector('p').textContent.trim(),
        lines: Math.round(el.getBoundingClientRect().height / lh),
        fits: el.scrollWidth <= box.clientWidth,
        row: Math.round(box.getBoundingClientRect().top),
      };
    }));
    console.log(`  @${vp.width}px total boxes: ${totalBoxes.map((b) => `${b.label}: ${b.lines} line${b.lines === 1 ? '' : 's'}, ${b.fits ? 'fits' : 'OVERFLOWS'}`).join(' | ')} (rows: ${new Set(totalBoxes.map((b) => b.row)).size})`);

    const toggle = page.getByRole('button', { name: /show all details/i });
    await toggle.click();
    const pressed = await page.getByRole('button', { name: /show fewer details/i }).getAttribute('aria-pressed');
    const on = await measure();
    console.log(`  @${vp.width}px details ON (aria-pressed=${pressed}): ${JSON.stringify(on)}`);
    if (on.table) {
      // Sticky checks: scroll the table box and see the Staff column / header stay put.
      const sticky = await page.evaluate(() => {
        const box = document.querySelector('[data-testid="run-table"]');
        const firstTh = box.querySelector('tbody th');
        const headTh = box.querySelector('thead th:nth-child(2)');
        const before = { x: firstTh.getBoundingClientRect().left, y: headTh.getBoundingClientRect().top };
        box.scrollLeft = 400;
        box.scrollTop = 300;
        const after = { x: firstTh.getBoundingClientRect().left, y: headTh.getBoundingClientRect().top };
        box.scrollLeft = 0;
        box.scrollTop = 0;
        return { staffColumnStays: Math.abs(before.x - after.x) < 1, headerStays: Math.abs(before.y - after.y) < 1 };
      });
      console.log(`  @${vp.width}px sticky while scrolling: ${JSON.stringify(sticky)}`);
    }
    await page.screenshot({ path: join(OUT, `payroll-real-${vp.width}-all-details.png`), fullPage: true });
    const remembered = await page.evaluate(() => localStorage.getItem('myhrms:payrollDetails'));
    console.log(`  @${vp.width}px details remembered in localStorage: ${remembered}`);

    const controls = await innerControls(page);
    const small = controls.filter((r) => r.height < 48 && !(r.kind === 'mark' && r.disabled));
    summary.payroll.under48 += small.length;
    console.log(`  @${vp.width}px controls: ${controls.length}, under 48px: ${small.length}`);
    for (const r of small) console.log(`      UNDER 48 ${r.height}px ${r.kind} ${r.label}`);
    const axeResult = await new AxeBuilder({ page }).analyze();
    summary.payroll.axe += axeResult.violations.length;
    console.log(`  @${vp.width}px axe: ${axeResult.violations.length}${axeResult.violations.length ? ` — ${axeResult.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ')}` : ''}`);
    for (const v of axeResult.violations) for (const n of v.nodes.slice(0, 3)) console.log(`      ${v.id}: ${n.target.join(' ')}`);
    const cut = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
    }).length);
    summary.payroll.ellipsis += cut;
    console.log(`  @${vp.width}px text cut with "…": ${cut}`);

    if (vp.width === 1440) {
      await page.getByRole('searchbox', { name: /find a staff member/i }).fill('zzz');
      const none = await page.getByText(/No one matches/).innerText();
      console.log(`  search "zzz": ${none}`);
      await page.screenshot({ path: join(OUT, 'payroll-real-1440-search-none.png'), fullPage: true });
      await page.getByRole('button', { name: /clear search/i }).click();
      await page.getByRole('button', { name: /undo this payroll run/i }).click();
      await page.getByRole('alertdialog').waitFor();
      await page.waitForTimeout(300);
      console.log(`  undo dialog buttons: ${(await page.getByRole('alertdialog').getByRole('button').allInnerTexts()).join(' | ')}`);
      await page.screenshot({ path: join(OUT, 'payroll-real-1440-undo-dialog.png') });
    }
    // Back to the default (details off) for the side-by-side picture.
    await page.evaluate(() => localStorage.setItem('myhrms:payrollDetails', '0'));
    await context.close();
    await sideBySide(`payroll-${vp.width}-simple.png`, simplePath, `compare-payroll-${vp.width}-simple.png`, vp.width === 1440 ? 720 : 390);
  }
}

// ── Contrast sweep and forced colors (scripts/lib/contrast-sweep.mjs) ─────
// Every route as Admin and Home as Employee; light and dark, 1440 and 390,
// Normal and Bigger text; each tab and the main dialog/sheet. axe
// color-contrast, every axe "incomplete" item measured on the real pixels
// (crops in <outDir>/incomplete at 1440 Normal), every chart mark at 3:1.
summary.sweep = await contrastSweep({
  browser,
  base: BASE,
  outDir: OUT,
  login,
  admin: ROLES[0],
  others: [ROLES[1], ROLES[2], ROLES[3]],
  routes: [...new Set([...ROUTES, '/more', '/go/staff'])],
});

// Windows high contrast (forced-colors emulation): Home, the Payroll run
// page and the Apply for leave form keep control borders and a focus outline.
console.log('\n=== Forced colors (Windows high contrast) @1440px');
summary.forced = { controls: 0, noBorder: 0, stops: 0, noRing: 0 };
{
  const { context, page } = await newPage(WIDTHS[0]);
  await login(page, ROLES[0]);
  const runId = await page.evaluate(async () => {
    const { runPayroll, finalizePayrollRun } = await import('/src/lib/payrollEngine.ts');
    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const r = runPayroll(mk, undefined, 'Admin').run;
    if (r.status === 'draft') finalizePayrollRun(r.id, 'Admin');
    return r.id;
  });
  const pages = [
    ['Home', '/'],
    ['Payroll run', `/payroll/runs/${runId}`],
    ['Apply for leave form', '/leave?tab=apply'],
  ];
  for (const [name, path] of pages) {
    await page.goto(`${BASE}${path}`);
    await page.locator('h1').first().waitFor({ timeout: 20000 });
    await page.waitForLoadState('networkidle');
    if (name.startsWith('Apply')) await page.getByRole('tab', { name: /^apply/i }).click().catch(() => {});
    await page.waitForTimeout(400);
    const r = await forcedColorsCheck(page, name, join(OUT, `forced-colors-${name.toLowerCase().replace(/\W+/g, '-')}.png`));
    for (const k of Object.keys(summary.forced)) summary.forced[k] += r[k];
  }
  await context.close();
}

await browser.close();
const sw = summary.sweep;
const fc = summary.forced;
console.log(`\nSUMMARY:`);
console.log(`Page sweep: ${sw.states} page states (incl. ${sw.tabs} tabs, ${sw.dialogs} dialogs), controls under 48px ${sw.under48} (org-chart toggles: ${sw.chartToggles}), axe (all rules) ${sw.axeAll}, text cut ${sw.cut}, ${sw.axe} axe color-contrast violation(s); ${sw.incomplete} axe-incomplete item(s) probed, ${sw.probeFail} under the minimum; ${sw.marks} chart mark(s), ${sw.markFail} under 3:1`);
console.log(`Forced colors: ${fc.controls} control(s), ${fc.noBorder} without a border; ${fc.stops} focus stop(s), ${fc.noRing} without a visible outline`);
console.log(`${summary.under48} shell/Home/group control(s) under 48px, ${summary.inner} inner-page input/select/tab/button(s) under 48px, ${summary.marks} checkbox/radio/switch clickable row(s) under 48px, ${summary.axe} axe violation(s), ${summary.wraps} label(s) over 2 lines, ${summary.ellipsis} text(s) cut with an ellipsis; Home at 3 text sizes: ${summary.overflow} overflowing element(s), ${summary.homeAxe} axe violation(s); Payroll run page: ${summary.payroll.under48} control(s) under 48px, ${summary.payroll.axe} axe violation(s), ${summary.payroll.ellipsis} text(s) cut`);
console.log(`Screenshots: ${OUT}`);

/**
 * Home and Payroll run check, run with UI_CHECK_SAMPLE=home: Home as Admin,
 * HR, Manager and Employee, and a finished Payroll run (Admin); light and dark,
 * 1440 and 390, Normal and Bigger text. Per page: controls under 48px, grid
 * items at least 96px tall with 18px labels, axe (all rules), contrast (axe,
 * the probe on axe-incomplete items, chart marks), text cut with "…". 2-press check per role: every page the role may open (the app's own
 * visibleNavItems) is a link on Home or in the "More" sheet. Returns the
 * number of failures.
 */
async function homeSample() {
  const ctx = { summary: { states: 0, axe: 0, incomplete: 0, probeFail: 0, marks: 0, markFail: 0 } };
  const r = { under48: 0, axeAll: 0, cut: 0, unreachable: 0, forcedNoBorder: 0, forcedNoRing: 0, small: 0 };
  const pageChecks = async (page, label, size) => {
    const controls = await innerControls(page);
    const small = controls.filter((c) => c.height < 48 && !(c.kind === 'mark' && c.disabled));
    const axeAll = (await new AxeBuilder({ page }).analyze()).violations;
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll('main *')].filter((el) => {
        const cs = getComputedStyle(el);
        return cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      }).length,
    );
    // Grid items: at least 96px tall, labels at least 18px.
    const grid = await page.evaluate(() =>
      [...document.querySelectorAll('main ul a, main ul button')]
        .filter((el) => el.querySelector('.duo-icon'))
        .map((el) => ({
          h: Math.round(el.getBoundingClientRect().height),
          font: parseFloat(getComputedStyle(el.querySelector(':scope > span:last-child')).fontSize),
          label: el.textContent.trim(),
        })),
    );
    const tooSmall = grid.filter((g) => g.h < 96 || g.font < 18);
    r.under48 += small.length;
    r.axeAll += axeAll.length;
    r.cut += cut;
    r.small += tooSmall.length;
    console.log(`  ${label.padEnd(36)} controls ${controls.length}, under 48px ${small.length}; grid items ${grid.length} (under 96px or label under 18px: ${tooSmall.length}); axe (all rules) ${axeAll.length}; cut text ${cut}`);
    for (const c of small) console.log(`      UNDER 48 ${c.height}px ${c.kind} ${c.label}`);
    for (const g of tooSmall) console.log(`      SMALL GRID ITEM ${g.h}px / ${g.font}px ${g.label} (${size})`);
    for (const v of axeAll) console.log(`      AXE ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`);
    await checkState(page, ctx, `  contrast ${label}`);
  };
  const roles = ROLES; // Admin, HR, Manager, Employee

  for (const theme of ['light', 'dark']) {
    for (const vp of WIDTHS) {
      for (const size of ['normal', 'bigger']) {
        console.log(`\n=== Home and Payroll run: ${theme} ${vp.width} ${size}`);
        for (const account of roles) {
          const { context, page } = await newPage(vp);
          await page.addInitScript(
            ([t, s]) => {
              localStorage.setItem('myhrms:theme', t);
              localStorage.setItem('myhrms:textSize', s);
            },
            [theme, size],
          );
          await login(page, account);
          await page.mouse.move(0, 0);
          await pageChecks(page, `Home (${account.role})`, size);

          if (vp.width === 1440 && size === 'normal') {
            // 2 presses: a Home link (1), or More (1) + a link on the More page (2).
            const reach = new Set(await page.locator('main a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))));
            await page.locator('main a[href="/more"]').click();
            // Wait for the More page itself (Home's own h1 is still there for a moment).
            await page.waitForURL('**/more');
            await page.locator('#more-staff, #more-time, #more-pay').first().waitFor();
            await page.waitForLoadState('networkidle');
            for (const h of await page.locator('main a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) reach.add(h);
            await pageChecks(page, `More page (${account.role})`, size);
            await page.goto(`${BASE}/`);
            await page.locator('h1').first().waitFor();
            const allowed = await page.evaluate(async (role) => {
              const { visibleNavItems } = await import('/src/components/layout/nav.ts');
              return visibleNavItems(role, false).map((i) => i.path);
            }, account.role);
            const missing = allowed.filter((p) => p !== '/' && !reach.has(p));
            const unexpected = missing;
            r.unreachable += unexpected.length;
            console.log(`  2-press check (${account.role}, ${theme}): ${allowed.length - 1} pages, not on Home or in More: ${missing.join(', ') || 'none'} (unexpected: ${unexpected.length})`);
          }

          if (account.role === 'Admin') {
            const runId = await page.evaluate(async () => {
              const { runPayroll, finalizePayrollRun } = await import('/src/lib/payrollEngine.ts');
              const now = new Date();
              const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              const run = runPayroll(mk, undefined, 'Admin').run;
              if (run.status === 'draft') finalizePayrollRun(run.id, 'Admin');
              return run.id;
            });
            await page.goto(`${BASE}/payroll/runs/${runId}`);
            await page.locator('h1').first().waitFor({ timeout: 20000 });
            await page.waitForLoadState('networkidle');
            await pageChecks(page, 'Payroll run', size);
            if (vp.width === 1440 && size === 'normal') {
              for (const [name, path] of [['Home', '/'], ['Payroll run', `/payroll/runs/${runId}`]]) {
                await page.goto(`${BASE}${path}`);
                await page.locator('h1').first().waitFor();
                await page.waitForLoadState('networkidle');
                const f = await forcedColorsCheck(page, `forced colors ${theme} ${name}`, join(OUT, `home-forced-${theme}-${name.toLowerCase().replace(/\W+/g, '-')}.png`));
                r.forcedNoBorder += f.noBorder;
                r.forcedNoRing += f.noRing;
              }
            }
          }
          await context.close();
        }
      }
    }
  }
  const s = ctx.summary;
  console.log(`\nSUMMARY (Home and Payroll run): ${s.states} page states; controls under 48px ${r.under48}; grid items under 96px / labels under 18px ${r.small}; axe violations (all rules) ${r.axeAll}; axe color-contrast ${s.axe}; axe-incomplete probed ${s.incomplete}, under the minimum ${s.probeFail}; chart marks ${s.marks}, under 3:1 ${s.markFail}; text cut ${r.cut}; pages not reachable in 2 presses ${r.unreachable}; forced colors: ${r.forcedNoBorder} control(s) without a border, ${r.forcedNoRing} focus stop(s) without an outline`);
  return r.under48 + r.small + r.axeAll + s.axe + s.probeFail + s.markFail + r.cut + r.unreachable + r.forcedNoBorder + r.forcedNoRing;
}

/**
 * Login, the public onboarding form, a payslip and its print view, in light
 * and dark, desktop and phone, Normal and Bigger text (UI_CHECK_SAMPLE=extra).
 * Print: the header band and bottom bar are gone, the paper is white and the
 * text keeps its contrast.
 */
async function extraPages() {
  const ctx = { summary: { states: 0, axe: 0, incomplete: 0, probeFail: 0, marks: 0, markFail: 0 } };
  let printFail = 0;
  const shots = join(OUT, 'extra');
  mkdirSync(shots, { recursive: true });
  for (const theme of ['light', 'dark']) {
    for (const vp of WIDTHS) {
      for (const size of ['normal', 'bigger']) {
        console.log(`\n=== Extra pages: ${theme} ${vp.width} ${size}`);
        const { context, page } = await newPage(vp);
        await page.addInitScript(
          ([t, s]) => {
            localStorage.setItem('myhrms:theme', t);
            localStorage.setItem('myhrms:textSize', s);
          },
          [theme, size],
        );
        const tag = `${theme}-${vp.width}-${size}`;

        await page.goto(`${BASE}/login`);
        await page.locator('#username').waitFor();
        await page.mouse.move(0, 0);
        await checkState(page, ctx, `  Login`);
        await page.screenshot({ path: join(shots, `login-${tag}.png`), fullPage: true });

        await login(page, ROLES[0]);
        const token = await page.evaluate(async () => {
          const { createOnboardLink } = await import('/src/lib/onboardLinks.ts');
          return createOnboardLink({ companyId: 'co-asm', label: 'UI check', createdBy: 'ui-check' }).token;
        });
        await page.goto(`${BASE}/onboard/${token}`);
        await page.locator('main').first().waitFor();
        await page.waitForLoadState('networkidle');
        await checkState(page, ctx, `  Onboarding form`);
        await page.screenshot({ path: join(shots, `onboard-${tag}.png`), fullPage: true });

        // The fresh demo company has no run yet: make this month's with the app's engine.
        await page.goto(`${BASE}/payroll`);
        await page.locator('h1').first().waitFor();
        const runId = await page.evaluate(async () => {
          const { runPayroll } = await import('/src/lib/payrollEngine.ts');
          const now = new Date();
          return runPayroll(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, undefined, 'Admin').run.id;
        });
        await page.goto(`${BASE}/payroll/runs/${runId}`);
        // Phones show the run as cards; the table link is hidden there, so go by its address.
        await page.locator('a[href^="/payroll/payslip/"]').first().waitFor({ state: 'attached' });
        await page.goto(BASE + (await page.locator('a[href^="/payroll/payslip/"]').first().getAttribute('href')));
        await page.waitForURL('**/payroll/payslip/**');
        await page.waitForLoadState('networkidle');
        await checkState(page, ctx, `  Payslip`);
        await page.screenshot({ path: join(shots, `payslip-${tag}.png`), fullPage: true });

        // Print: what window.print() does (beforeprint, then print media).
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await page.emulateMedia({ media: 'print' });
        const print = await page.evaluate(() => {
          const shown = (sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
          return {
            band: shown('header'),
            bottomBar: shown('nav.fixed'),
            dark: document.documentElement.classList.contains('dark'),
            body: getComputedStyle(document.body).backgroundColor,
          };
        });
        const ok = !print.band && !print.bottomBar && !print.dark && print.body === 'rgb(255, 255, 255)';
        if (!ok) printFail++;
        console.log(`  Print view: band ${print.band ? 'SHOWN' : 'hidden'}, bottom bar ${print.bottomBar ? 'SHOWN' : 'hidden'}, dark tokens ${print.dark ? 'ON' : 'off'}, paper ${print.body} ${ok ? 'OK' : 'FAIL'}`);
        // On paper only the payslip is visible, so axe's page-structure rules
        // (one main, one h1) do not apply; contrast and cut text still count.
        const axeBefore = ctx.summary.axeAll ?? 0;
        await checkState(page, ctx, `  Payslip (print; axe structure rules not counted)`);
        ctx.summary.axeAll = axeBefore;
        await page.screenshot({ path: join(shots, `payslip-print-${tag}.png`), fullPage: true });
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        await context.close();
      }
    }
  }
  const sm = ctx.summary;
  console.log(`\nSUMMARY (extra): ${sm.states} page states; controls under 48px ${sm.under48 ?? 0}; axe (all rules) ${sm.axeAll ?? 0}; axe color-contrast ${sm.axe}; probed ${sm.incomplete}, under the minimum ${sm.probeFail}; chart marks ${sm.marks}, under 3:1 ${sm.markFail}; text cut ${sm.cut ?? 0}; print failures ${printFail}`);
  return (sm.under48 ?? 0) + (sm.axeAll ?? 0) + sm.axe + sm.probeFail + sm.markFail + (sm.cut ?? 0) + printFail;
}

/**
 * Tenant colours (UI_CHECK_SAMPLE=brand): the ASM indigo and every seeded
 * tenant colour applied through the app's own branding code, then Home, More
 * and Leave checked in light and dark, desktop and phone. Prints the band and
 * icon colours the page actually shows.
 */
async function brandPages() {
  const ctx = { summary: { states: 0, axe: 0, incomplete: 0, probeFail: 0, marks: 0, markFail: 0 } };
  const shots = join(OUT, 'brand');
  mkdirSync(shots, { recursive: true });
  const colours = ['#2E2F70', '#4d7c0f', '#0f766e', '#9a3412'];
  for (const theme of ['light', 'dark']) {
    for (const vp of WIDTHS) {
      const { context, page } = await newPage(vp);
      await page.addInitScript((t) => localStorage.setItem('myhrms:theme', t), theme);
      await login(page, ROLES[0]);
      for (const hex of colours) {
        console.log(`\n=== Brand ${hex}: ${theme} ${vp.width}`);
        for (const route of ['/', '/more', '/leave']) {
          await page.goto(BASE + route);
          await page.locator('h1').first().waitFor();
          await page.waitForLoadState('networkidle');
          // After the app's own branding effect: apply this tenant colour.
          await page.evaluate(async (c) => {
            const { applyCompanyBranding } = await import('/src/pages/company/branding.ts');
            applyCompanyBranding({ logoText: 'X', accentColor: c });
          }, hex);
          await page.mouse.move(0, 0);
          const seen = await page.evaluate(() => {
            const cs = (el, p) => (el ? getComputedStyle(el)[p] : '-');
            return {
              band: cs(document.querySelector('header'), 'backgroundColor'),
              icon: cs(document.querySelector('.duo-icon'), 'color'),
              cta: cs(document.querySelector('main [data-slot="button"]'), 'backgroundColor'),
            };
          });
          console.log(`  ${route.padEnd(8)} band ${seen.band}, icon ${seen.icon}, first button ${seen.cta}`);
          await checkState(page, ctx, `  ${route} (${hex})`);
          if (route === '/') await page.screenshot({ path: join(shots, `home-${hex.slice(1)}-${theme}-${vp.width}.png`), fullPage: true });
        }
      }
      await context.close();
    }
  }
  const sm = ctx.summary;
  console.log(`\nSUMMARY (brand): ${sm.states} page states; controls under 48px ${sm.under48 ?? 0}; axe (all rules) ${sm.axeAll ?? 0}; axe color-contrast ${sm.axe}; probed ${sm.incomplete}, under the minimum ${sm.probeFail}; text cut ${sm.cut ?? 0}`);
  return (sm.under48 ?? 0) + (sm.axeAll ?? 0) + sm.axe + sm.probeFail + (sm.cut ?? 0);
}
