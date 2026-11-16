/**
 * Shown instead of Approve / Reject on the signed-in person's own leave,
 * claim or overtime request: nobody decides their own request (the decide
 * functions refuse it too, and so does the server — writePolicy.ts).
 */
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OwnRequestNote({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cn('flex items-start gap-1.5 text-muted-foreground', className)}>
      <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      {t('approvals.ownRequest')}
    </p>
  );
}
