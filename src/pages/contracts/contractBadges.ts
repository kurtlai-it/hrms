/**
 * Shared presentational helpers for the contracts module (non-component
 * module so pages stay react-refresh safe).
 */
import type { ContractKind, ContractStatus, EmploymentContract } from '@/lib/contracts';

export function statusBadgeClass(s: ContractStatus): string {
  switch (s) {
    case 'active':
      return 'bg-success-soft text-success';
    case 'expiring':
      return 'bg-warning-soft text-warning';
    case 'expired':
      return 'bg-danger-soft text-destructive';
    case 'draft':
      return 'bg-secondary text-foreground';
    case 'renewed':
      return 'bg-accent text-accent-foreground';
    case 'terminated':
      return 'bg-secondary text-muted-foreground line-through';
  }
}

export function kindBadgeClass(kind: ContractKind): string {
  return kind === 'of-service'
    ? 'bg-warning-soft text-warning'
    : 'bg-secondary text-foreground';
}

export function remunerationUnit(c: EmploymentContract): string {
  switch (c.remuneration.mode) {
    case 'monthly-salary':
      return '/mo';
    case 'daily':
      return '/day';
    case 'hourly':
      return '/hr';
    case 'fixed-fee':
      return 'fixed';
    case 'per-deliverable':
      return '/deliverable';
  }
}
