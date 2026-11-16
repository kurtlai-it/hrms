/**
 * e-Claims module — shared metadata, company claim policy and limit checks.
 *
 * Policy limits (meal / medical / phone caps, mileage rate) are COMPANY policy,
 * not statutory figures. They are read from the 'settings' collection when a
 * document with id 'claimPolicy' exists (written by the Settings module),
 * otherwise module defaults below apply. Statutory money never appears here.
 */
import { fmtRM } from '@/lib/utils';
import type { Claim, ClaimCategory, ClaimStatus } from '@/lib/types';

/**
 * Module-local claim record. Adds approver remarks and the mileage breakdown
 * to the core Claim shape. The payroll engine only reads core fields and
 * spreads unknown fields through untouched, so the extension is safe.
 */
export type ClaimRecord = Claim & {
  decisionRemarks?: string;
  mileageKm?: number;
  mileageRate?: number;
  /** Receipt bytes live in the docStore ('docBytes' collection) — this is the reference. */
  receiptDocId?: string;
  /** Set when the draft was prefilled by AI receipt extraction (badge while in draft). */
  aiExtracted?: boolean;
};

/** UI-level category — 'mileage' is a guided flavour of the 'travel' category. */
export type UiCategory = ClaimCategory | 'mileage';

export interface CategoryMeta {
  id: UiCategory;
  label: string;
  /** Core ClaimCategory actually stored on the record. */
  claimCategory: ClaimCategory;
  /** Warm-palette hex used by charts and accent dots. */
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'travel', label: 'Travel', claimCategory: 'travel', color: 'hsl(var(--chart-1))' },
  { id: 'mileage', label: 'Mileage', claimCategory: 'travel', color: 'hsl(var(--chart-1))' },
  { id: 'meal', label: 'Meal & Entertainment', claimCategory: 'meal', color: 'hsl(var(--chart-2))' },
  { id: 'medical', label: 'Medical', claimCategory: 'medical', color: 'hsl(var(--chart-3))' },
  { id: 'telephone', label: 'Phone & Internet', claimCategory: 'telephone', color: 'hsl(var(--chart-6))' },
  { id: 'parking', label: 'Parking & Toll', claimCategory: 'parking', color: 'hsl(var(--chart-4))' },
  { id: 'training', label: 'Training', claimCategory: 'training', color: 'hsl(var(--chart-5))' },
  { id: 'other', label: 'Other', claimCategory: 'other', color: 'hsl(var(--chart-grid))' },
];

/** Chart colours keyed by the core category (mileage folds into travel). */
export const CATEGORY_COLOR: Record<ClaimCategory, string> = {
  travel: 'hsl(var(--chart-1))',
  meal: 'hsl(var(--chart-2))',
  medical: 'hsl(var(--chart-3))',
  parking: 'hsl(var(--chart-4))',
  telephone: 'hsl(var(--chart-6))',
  training: 'hsl(var(--chart-5))',
  other: 'hsl(var(--chart-grid))',
};

export const CATEGORY_LABEL: Record<ClaimCategory, string> = {
  travel: 'Travel',
  meal: 'Meal & Entertainment',
  medical: 'Medical',
  parking: 'Parking & Toll',
  telephone: 'Phone & Internet',
  training: 'Training',
  other: 'Other',
};

/** Display category for a record — mileage claims show as 'Mileage'. */
export function categoryMetaOf(c: ClaimRecord): CategoryMeta {
  if (c.category === 'travel' && c.mileageKm != null) {
    return CATEGORIES.find((m) => m.id === 'mileage')!;
  }
  return CATEGORIES.find((m) => m.claimCategory === c.category && m.id !== 'mileage')
    ?? CATEGORIES[CATEGORIES.length - 1]!;
}

// ── Policy ──────────────────────────────────────────────────────────────────

export interface ClaimPolicy {
  mileageRatePerKm: number; // RM per km
  mealDailyLimit: number; // RM per calendar day
  medicalClaimLimit: number; // RM per claim
  phoneMonthlyLimit: number; // RM per calendar month
}

export const DEFAULT_POLICY: ClaimPolicy = {
  mileageRatePerKm: 0.8,
  mealDailyLimit: 50,
  medicalClaimLimit: 200,
  phoneMonthlyLimit: 100,
};

/** Document id the Settings module may write into the 'settings' collection. */
export const POLICY_DOC_ID = 'claimPolicy';

/** Structural shape of the optional policy doc (module-local, read-only here). */
export interface ClaimPolicyDoc {
  id: string;
  mileageRatePerKm?: number;
  mealDailyLimit?: number;
  medicalClaimLimit?: number;
  phoneMonthlyLimit?: number;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

// ── Core appSettings bridge (Wave 2) ────────────────────────────────────────
// The core agent adds `getClaimPolicy()` in '@/lib/appSettings' this wave.
// Resolve it optionally (empty glob match when the file hasn't landed yet) so
// this module compiles and behaves identically with or without it. When the
// helper is present its values win over the settings doc; malformed values
// are ignored and fall through to the doc/default chain.

interface AppSettingsLike {
  getClaimPolicy?: () => unknown;
}

const appSettings = Object.values(
  import.meta.glob('../../lib/appSettings.ts', { eager: true }),
)[0] as AppSettingsLike | undefined;

function policyFromAppSettings(): Partial<ClaimPolicy> {
  try {
    const v = appSettings?.getClaimPolicy?.();
    if (!v || typeof v !== 'object') return {};
    const r = v as Record<string, unknown>;
    const out: Partial<ClaimPolicy> = {};
    const keys = [
      'mileageRatePerKm', 'mealDailyLimit', 'medicalClaimLimit', 'phoneMonthlyLimit',
    ] as const;
    for (const k of keys) {
      if (typeof r[k] === 'number') out[k] = r[k] as number;
    }
    return out;
  } catch {
    return {};
  }
}

/** Merge policy sources: appSettings helper → settings doc → module defaults. */
export function resolvePolicy(docs: ClaimPolicyDoc[]): ClaimPolicy {
  const lib = policyFromAppSettings();
  const d = docs.find((x) => x.id === POLICY_DOC_ID);
  return {
    mileageRatePerKm: num(lib.mileageRatePerKm ?? d?.mileageRatePerKm, DEFAULT_POLICY.mileageRatePerKm),
    mealDailyLimit: num(lib.mealDailyLimit ?? d?.mealDailyLimit, DEFAULT_POLICY.mealDailyLimit),
    medicalClaimLimit: num(lib.medicalClaimLimit ?? d?.medicalClaimLimit, DEFAULT_POLICY.medicalClaimLimit),
    phoneMonthlyLimit: num(lib.phoneMonthlyLimit ?? d?.phoneMonthlyLimit, DEFAULT_POLICY.phoneMonthlyLimit),
  };
}

// ── Soft limit checks ───────────────────────────────────────────────────────

export interface ClaimDraftInput {
  employeeId: string;
  category: ClaimCategory;
  amount: number;
  claimDate: string; // ISO date
  /** Set for mileage claims so the rate can be checked against the policy rate. */
  mileageRate?: number;
}

/**
 * Soft policy warnings for a claim — never blocks submission, but approvers
 * see the same flags in their inbox. `excludeId` skips the record itself when
 * editing or flagging an existing claim.
 */
export function policyWarnings(
  draft: ClaimDraftInput,
  existing: ClaimRecord[],
  policy: ClaimPolicy,
  excludeId?: string,
): string[] {
  const warns: string[] = [];
  if (!draft.claimDate || !(draft.amount > 0)) return warns;
  // Limits reflect actually-submitted spend — drafts and rejected claims don't count.
  const mine = existing.filter(
    (c) =>
      c.employeeId === draft.employeeId &&
      c.id !== excludeId &&
      c.status !== 'rejected' &&
      c.status !== 'draft',
  );

  if (draft.category === 'meal') {
    const dayTotal = mine
      .filter((c) => c.category === 'meal' && c.claimDate === draft.claimDate)
      .reduce((s, c) => s + c.amount, 0);
    if (dayTotal + draft.amount > policy.mealDailyLimit) {
      warns.push(
        `Meal claims on this date would total ${fmtRM(dayTotal + draft.amount)} — above the ${fmtRM(policy.mealDailyLimit)}/day policy limit.`,
      );
    }
  }

  if (draft.category === 'medical' && draft.amount > policy.medicalClaimLimit) {
    warns.push(
      `Medical claim is above the ${fmtRM(policy.medicalClaimLimit)} per-claim policy limit.`,
    );
  }

  // Mileage stays editable for exceptions, but an above-policy rate is flagged.
  if (
    draft.category === 'travel' &&
    draft.mileageRate != null &&
    draft.mileageRate > policy.mileageRatePerKm
  ) {
    warns.push(
      `Mileage rate of ${fmtRM(draft.mileageRate)}/km is above the ${fmtRM(policy.mileageRatePerKm)}/km policy rate — the approver will be asked to verify it.`,
    );
  }

  if (draft.category === 'telephone') {
    const mk = draft.claimDate.slice(0, 7);
    const monthTotal = mine
      .filter((c) => c.category === 'telephone' && c.claimDate.startsWith(mk))
      .reduce((s, c) => s + c.amount, 0);
    if (monthTotal + draft.amount > policy.phoneMonthlyLimit) {
      warns.push(
        `Phone & internet claims for ${mk} would total ${fmtRM(monthTotal + draft.amount)} — above the ${fmtRM(policy.phoneMonthlyLimit)}/month policy limit.`,
      );
    }
  }

  return warns;
}

// ── Status pipeline ─────────────────────────────────────────────────────────

export const STATUS_META: Record<ClaimStatus, { label: string; badgeClass: string }> = {
  draft: { label: 'Draft', badgeClass: 'border-border bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', badgeClass: 'border-warning/40 bg-warning-soft text-warning' },
  approved: { label: 'Approved', badgeClass: 'border-success/40 bg-success-soft text-success' },
  rejected: { label: 'Rejected', badgeClass: 'border-destructive/40 bg-danger-soft text-destructive' },
  paid: { label: 'Paid', badgeClass: 'border-success bg-success text-success-foreground' },
};
