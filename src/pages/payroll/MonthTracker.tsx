/**
 * "This month's payroll" — the 5 steps of a pay month with "You are here"
 * (docs/design/DESIGN.md: payroll steps say "You are here"). Lives on the
 * Payroll page, not Home.
 *
 * Steps 1–3 follow this month's run (none → draft → finalized). The system
 * cannot see bank or statutory payments, so HR/Admin mark steps 4–5 done by
 * hand (lib/payrollSteps): "Done by <name> on <date>", with Undo behind a
 * confirm dialog.
 *
 * variant 'month' (Payroll page): this month's run. variant 'run' (Payroll
 * run page): the given run, heading "Step 4 of 5: …", no "Open" buttons
 * (they would point at the page already open).
 *
 * One flat row of steps split by thin lines (no boxes in the card, no
 * numbered circles); each step has a word label: mint "Done", "You are
 * here" on the highlighted step, peach "Due <date>".
 */
import { paydayFor, statutoryDueFor } from '@/lib/payDates';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Clock, MapPin, Undo2 } from 'lucide-react';
import { cn, monthKey } from '@/lib/utils';
import { useAuth } from '@/lib/useAuth';
import { useCollection } from '@/lib/db';
import { markRunStep, undoRunStep } from '@/lib/payrollSteps';
import type { Employee, PayrollRun, PayrollRunStep } from '@/lib/types';
import { formatDate } from '@/i18n';
import { greetingName } from '@/pages/dashboard/lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type StepState = 'done' | 'here' | 'next';

interface Step {
  title: string;
  detail: string;
  done: boolean;
  /** Steps 4–5: the hand-made mark. */
  markKey?: PayrollRunStep;
  action?: ReactNode;
  /** Steps 4–5: the date it is due (ISO), shown as a "Due" label until done. */
  due?: string;
}

export function MonthTracker({
  runs,
  run: givenRun,
  paydayDay,
  onStart,
  variant = 'month',
}: {
  runs: PayrollRun[];
  /** Show this run's month instead of the current month. */
  run?: PayrollRun;
  paydayDay?: number;
  onStart?: () => void;
  variant?: 'month' | 'run';
}) {
  const { t } = useTranslation();
  const { role, user, employeeId } = useAuth();
  const { items: employees } = useCollection<Employee>('employees');
  const [undoStep, setUndoStep] = useState<PayrollRunStep | null>(null);

  const canMark = role === 'Admin' || role === 'HR' || role === 'SuperAdmin';
  const me = greetingName(employees.find((e) => e.id === employeeId)?.name, user?.username) || 'HR';
  const mk = givenRun?.monthKey ?? monthKey();
  const [y, m] = mk.split('-').map(Number);
  const month = formatDate(new Date(y!, m! - 1, 1), { month: 'long', year: 'numeric' });
  const run = givenRun ?? runs.find((r) => r.monthKey === mk);
  const finalized = run?.status === 'finalized';
  const open = run && variant === 'month' && (
    <Button asChild>
      <Link to={`/payroll/runs/${run.id}`}>{t('tracker.open')}</Link>
    </Button>
  );

  const steps: Step[] = [
    {
      title: t('tracker.s1Title', { month }),
      detail: t('tracker.s1Detail'),
      done: Boolean(run),
      action: !run && onStart && <Button onClick={onStart}>{t('tracker.start')}</Button>,
    },
    { title: t('tracker.s2Title'), detail: t('tracker.s2Detail'), done: finalized, action: run?.status === 'draft' && open },
    { title: t('tracker.s3Title'), detail: t('tracker.s3Detail'), done: finalized },
    {
      title: t('tracker.s4Title'),
      detail: paydayDay
        ? t('tracker.s4DetailDate', { date: formatDate(paydayFor(mk, paydayDay)) })
        : t('tracker.s4Detail'),
      done: Boolean(run?.stepsDone?.staffPaid),
      markKey: 'staffPaid',
      due: paydayDay ? paydayFor(mk, paydayDay) : undefined,
    },
    {
      title: t('tracker.s5Title'),
      detail: t('tracker.s5Detail', { date: formatDate(statutoryDueFor(mk)) }),
      done: Boolean(run?.stepsDone?.statutoryPaid),
      markKey: 'statutoryPaid',
      due: statutoryDueFor(mk),
    },
  ];
  const hereIndex = steps.findIndex((s) => !s.done);
  const state = (i: number): StepState => (steps[i]!.done ? 'done' : i === hereIndex ? 'here' : 'next');
  const undoTitle = undoStep ? steps.find((s) => s.markKey === undoStep)?.title ?? '' : '';

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-[1.35rem] font-bold">
          {variant === 'run' && hereIndex !== -1
            ? t('tracker.stepOf', { n: hereIndex + 1, title: steps[hereIndex]!.title })
            : t('tracker.title', { month })}
        </CardTitle>
        {hereIndex === -1 && (
          <p className="flex items-center gap-2 font-bold text-success">
            <Check className="size-5" aria-hidden="true" /> {t('tracker.allDone', { month })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ol className="grid overflow-hidden lg:grid-cols-5">
          {steps.map((s, i) => {
            const st = state(i);
            const mark = s.markKey ? run?.stepsDone?.[s.markKey] : undefined;
            return (
              <li
                key={i}
                aria-current={st === 'here' ? 'step' : undefined}
                // Thin lines between steps (top/left), clipped at the panel edge.
                className={cn(
                  'flex flex-col gap-2 p-4 shadow-[-1px_-1px_0_0_hsl(var(--border))]',
                  st === 'here' ? 'bg-accent text-accent-foreground' : 'bg-card',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">{t('tracker.step', { n: i + 1 })}</span>
                    {st === 'done' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 font-bold text-success">
                        <Check className="size-5" aria-hidden="true" /> {t('tracker.done')}
                      </span>
                    )}
                    {st === 'here' && (
                      <span className="inline-flex items-center gap-1 font-bold text-primary">
                        <MapPin className="size-5" aria-hidden="true" /> {t('tracker.youAreHere')}
                      </span>
                    )}
                    {st !== 'done' && s.due && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 font-bold text-warning">
                        <Clock className="size-5" aria-hidden="true" /> {t('tracker.due', { date: formatDate(s.due) })}
                      </span>
                    )}
                </div>
                <p className="font-bold">
                  <span className="sr-only">{t('tracker.stepN', { n: i + 1 })} </span>
                  {s.title}
                </p>
                <p className="text-muted-foreground">{s.detail}</p>
                {mark && (
                  <p className="text-success">
                    {t('tracker.doneBy', { name: mark.by, date: formatDate(mark.at) })}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {s.action}
                  {s.markKey && finalized && canMark && !mark && (
                    <Button variant="outline" onClick={() => markRunStep(run!.id, s.markKey!, me)}>
                      <Check className="size-5" aria-hidden="true" /> {t('tracker.markDone')}
                    </Button>
                  )}
                  {s.markKey && mark && canMark && (
                    <Button variant="outline" onClick={() => setUndoStep(s.markKey!)}>
                      <Undo2 className="size-5" aria-hidden="true" /> {t('tracker.undo')}
                    </Button>
                  )}
                  {s.markKey && finalized && open}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>

      <AlertDialog open={undoStep !== null} onOpenChange={(o) => !o && setUndoStep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tracker.undoTitle', { step: undoTitle })}</AlertDialogTitle>
            <AlertDialogDescription>{t('tracker.undoBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('tracker.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (run && undoStep) undoRunStep(run.id, undoStep, me);
                setUndoStep(null);
              }}
            >
              {t('tracker.undoConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
