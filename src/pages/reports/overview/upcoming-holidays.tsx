/**
 * Upcoming public holidays widget — next 5 holidays for the HQ state
 * (Settings.hqState, default KUL) via getHolidays, including next-year
 * rollover. EA 1955 s.60D compulsory holidays and tentative dates are badged.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { useCollection } from '@/lib/db';
import { getHolidays, stateInfo } from '@/lib/holidays';
import { formatDate } from '@/i18n';
import type { Holiday, Settings } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { todayISO } from '@/pages/dashboard/lib';

function weekday(iso: string): string {
  return formatDate(iso, { weekday: 'short' });
}

export function UpcomingHolidays() {
  const { t } = useTranslation();
  const { items: settingsItems } = useCollection<Settings>('settings');
  // Subscribing to the 'holidays' collection keeps admin overrides reactive.
  const { items: overrides } = useCollection<Holiday>('holidays');
  const hq = settingsItems[0]?.hqState ?? 'KUL';

  const upcoming = useMemo(() => {
    // getHolidays reads the overrides collection straight from storage — the
    // React-side subscription above just retriggers this memo when admin
    // holiday overrides change.
    void overrides;
    const year = new Date().getFullYear();
    const today = todayISO();
    return [...getHolidays(year, hq), ...getHolidays(year + 1, hq)]
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [hq, overrides]);

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t('dash.holidays.title')}
        </CardTitle>
        <CardDescription>
          {upcoming.length > 0
            ? t('dash.holidays.next', { state: stateInfo(hq).name, count: upcoming.length })
            : stateInfo(hq).name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('dash.holidays.none', { state: stateInfo(hq).name })}
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((h) => (
              <li key={`${h.date}|${h.name}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {weekday(h.date)}, {formatDate(h.date)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {h.isCompulsoryEA && <Badge variant="secondary">{t('dash.holidays.eaCompulsory')}</Badge>}
                  {h.tentative && <Badge variant="outline">{t('dash.holidays.tentative')}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
