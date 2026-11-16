/**
 * Overview at the top of the Reports page — the figures that used to sit on
 * the old dashboard: headline cards, the four charts, statutory deadlines,
 * upcoming public holidays and alerts. Every figure is derived from live
 * collections and the shared lib engines; nothing is hardcoded here.
 *
 * Role gating: the Reports route is Admin / HR / Manager only. Managers get
 * department-scoped cards, charts and alerts; the payroll-cost card and the
 * payroll trend (company spend) stay Admin/HR-only.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';
import { formatDate } from '@/i18n';
import { todayISO } from '@/pages/dashboard/lib';
import { StatCards } from './stat-cards';
import { AttendanceRate, ClaimsDonut, HeadcountByDepartment, PayrollTrend } from './charts';
import { ComplianceDeadlines } from './compliance-deadlines';
import { UpcomingHolidays } from './upcoming-holidays';
import { AlertsPanel } from './alerts-panel';

export default function ReportsOverview() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const canSeePayroll = role === 'Admin' || role === 'HR';

  return (
    <section aria-labelledby="reports-overview" className="space-y-6">
      <div className="space-y-1">
        <h2 id="reports-overview" className="text-[1.35rem] font-bold">{t('dash.overview')}</h2>
        <p className="text-muted-foreground">
          {t('dash.subtitleStaff', { date: formatDate(todayISO()) })}
        </p>
      </div>

      <StatCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HeadcountByDepartment />
        {canSeePayroll && <PayrollTrend />}
        <AttendanceRate />
        <ClaimsDonut />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ComplianceDeadlines />
        <UpcomingHolidays />
        <AlertsPanel />
      </div>
    </section>
  );
}
