/**
 * Compliance Deadlines widget — next statutory filing dates with
 * countdown badges (computed in ../lib, no hardcoded dates).
 */
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { daysBetween } from '@/lib/utils';
import { formatDate } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { complianceDeadlines, todayISO } from '@/pages/dashboard/lib';

export function ComplianceDeadlines() {
  const { t } = useTranslation();
  const today = todayISO();
  const deadlines = complianceDeadlines();

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          {t('dash.compliance.title')}
        </CardTitle>
        <CardDescription>{t('dash.compliance.desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {deadlines.map((d) => {
            const days = daysBetween(today, d.due);
            const label = days <= 0 ? t('dash.compliance.dueToday') : t('dash.compliance.daysLeft', { count: days });
            const variant = days <= 7 ? 'destructive' : days <= 30 ? 'default' : 'secondary';
            return (
              <li key={d.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{t(`dash.compliance.${d.id}.title`)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(d.due)} · {t(`dash.compliance.${d.id}.note`)}
                  </p>
                </div>
                <Badge variant={variant} className="mt-0.5 shrink-0">
                  {label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
