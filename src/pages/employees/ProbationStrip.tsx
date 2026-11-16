import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { useCollection } from '@/lib/db';
import { useAuth } from '@/lib/useAuth';
import { fmtDate } from '@/lib/utils';
import type { Department, Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  ExtendProbationDialog,
  ProbationHistoryButton,
} from './ProbationActions';
import { confirmProbationAction, lastExtension } from './probation';
import { deptName, probationDaysLeft, probationEndDate } from './helpers';

/**
 * Probation to confirm — a table of everyone on probation, the end date
 * (extension-aware, see helpers.ts), how many days left or overdue, and
 * Confirm / Extend. Mutations are Admin/HR only.
 */
export function ProbationStrip() {
  const { t } = useTranslation();
  const { role, user } = useAuth();
  const canConfirm = role === 'Admin' || role === 'HR';
  const actorName = user?.username ?? 'HR Admin';

  const { items: employees } = useCollection<Employee>('employees');
  const { items: departments } = useCollection<Department>('departments');
  const [extendTarget, setExtendTarget] = useState<Employee | null>(null);

  const onProbation = employees
    .filter((e) => e.status === 'probation')
    .sort((a, b) => probationDaysLeft(a) - probationDaysLeft(b));

  if (!canConfirm || onProbation.length === 0) return null;

  return (
    <section aria-labelledby="probation-title" className="space-y-2">
      <h2 id="probation-title" className="text-[1.2rem] font-bold">
        {t('probation.title')}{' '}
        <span className="font-normal text-muted-foreground">· {t('probation.count', { count: onProbation.length })}</span>
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('probation.colName')}</TableHead>
            <TableHead>{t('probation.colEnds')}</TableHead>
            <TableHead>{t('probation.colStatus')}</TableHead>
            <TableHead><span className="sr-only">{t('probation.colActions')}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {onProbation.map((emp) => {
            const daysLeft = probationDaysLeft(emp);
            const overdue = daysLeft < 0;
            const extension = emp.probationExtendedTo ? lastExtension(emp) : undefined;
            return (
              <TableRow key={emp.id}>
                <TableCell>
                  <Link
                    to={`/employees/${emp.id}`}
                    className="font-bold text-primary underline-offset-4 hover:underline"
                  >
                    {emp.name}
                  </Link>
                  <p className="text-muted-foreground">{deptName(departments, emp.departmentId)}</p>
                </TableCell>
                <TableCell>
                  {fmtDate(probationEndDate(emp))}
                  {emp.probationExtendedTo && (
                    <p className="text-muted-foreground" title={extension?.reason ? `Reason: ${extension.reason}` : undefined}>
                      {t('probation.extendedTo', { date: fmtDate(emp.probationExtendedTo) })}
                    </p>
                  )}
                </TableCell>
                <TableCell className={overdue ? 'font-bold text-destructive' : ''}>
                  {overdue ? t('probation.overdue', { count: Math.abs(daysLeft) }) : t('probation.left', { count: daysLeft })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => confirmProbationAction(emp, actorName)}>
                      {t('probation.confirm')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setExtendTarget(emp)}>
                      {t('probation.extend')}
                    </Button>
                    <ProbationHistoryButton employee={emp} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {extendTarget && (
        <ExtendProbationDialog
          employee={extendTarget}
          actorName={actorName}
          open={extendTarget !== null}
          onOpenChange={(open) => !open && setExtendTarget(null)}
        />
      )}
    </section>
  );
}
