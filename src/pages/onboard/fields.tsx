/**
 * Small shared building blocks for the public onboarding wizard —
 * field wrapper with label + error, and the company branding header.
 * Kept dependency-light: no auth, no tenant context (public route).
 */
import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import type { Company } from '@/lib/types';
import { brandBandHex, brandSwatchHex } from '@/pages/company/branding';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export function Field({
  id,
  label,
  required,
  optional,
  error,
  children,
  className,
}: {
  id?: string;
  label?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} className="text-sm">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </Label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Read-only branding banner resolved from the link's company — no session. */
export function BrandingHeader({ company, subtitle }: { company?: Company; subtitle?: string }) {
  const accent = brandSwatchHex(company?.branding.accentColor);
  const logoText = company?.branding.logoText || company?.code || 'HR';
  return (
    // colors-ok: the tenant band colour, guarded to 7:1 with white text (brandBandHex)
    <header className="bg-bar text-bar-foreground" style={{ backgroundColor: brandBandHex(company?.branding.accentColor) }}>
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
        <span
          // colors-ok: white text on the guarded tenant color (4.5:1)
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-bar-foreground text-base font-bold text-white"
          style={{ backgroundColor: accent }}
          aria-hidden
        >
          {logoText.slice(0, 3).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="break-words text-[1.15rem] font-bold leading-tight">
            {company?.name ?? 'Employee Onboarding'}
          </p>
          <p className="flex items-center gap-1.5 text-bar-subtle">
            <Building2 aria-hidden className="h-4 w-4" />
            {subtitle ?? 'New-hire onboarding form'}
          </p>
        </div>
      </div>
    </header>
  );
}
