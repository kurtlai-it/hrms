/**
 * Org chart on phones: a plain indented list (department > position > person)
 * instead of the zoomed chart, whose cards would be too small to read. Every
 * row is at least 48px; people are shown with "Show 4 people" / "Hide".
 * Positions open the same edit sheet as a card in the chart.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OrgListDepartment } from '@/lib/orgList';
import type { Employee } from '@/lib/types';

const peopleWord = (n: number) => (n === 1 ? '1 person' : `${n} people`);

function PeopleList({ id, people }: { id: string; people: Employee[] }) {
  return (
    <ul id={id} className="ml-3 border-l-2 border-border pl-3">
      {people.map((e) => (
        <li key={e.id}>
          <Link
            to={`/employees/${e.id}`}
            className="flex min-h-12 flex-wrap items-center gap-x-2 py-1 font-bold text-primary underline-offset-4 hover:underline"
          >
            {e.name}
            {e.employeeNo && <span className="font-normal text-muted-foreground">{e.employeeNo}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OrgList({
  groups,
  onOpenPosition,
}: {
  groups: OrgListDepartment[];
  /** Opens the position's edit sheet (omit to show positions read-only). */
  onOpenPosition?: (positionId: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (groups.length === 0) {
    return <p className="text-muted-foreground">No departments yet. Add departments and positions in the structure manager.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const headId = `org-dept-${g.id || 'none'}`;
        return (
          <section key={g.id || 'none'} aria-labelledby={headId} className="space-y-1">
            <h2 id={headId} className="border-b-2 border-border pb-2 text-[1.2rem] font-bold">
              {g.name} <span className="font-normal text-muted-foreground">· {peopleWord(g.headcount)}</span>
            </h2>
            {g.positions.length === 0 && g.unplaced.length === 0 && (
              <p className="flex min-h-12 items-center text-muted-foreground">No positions yet.</p>
            )}
            <ul className="divide-y">
              {g.positions.map(({ position, people }) => {
                const key = `pos-${position.id}`;
                const shown = open.has(key);
                return (
                  <li key={position.id} className="py-1">
                    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {onOpenPosition ? (
                          <button
                            type="button"
                            onClick={() => onOpenPosition(position.id)}
                            className="min-h-12 text-left font-bold text-primary underline-offset-4 hover:underline"
                          >
                            {position.title}
                          </button>
                        ) : (
                          <span className="font-bold">{position.title}</span>
                        )}
                        {people.length === 0 && <Badge variant="outline" className="border-warning text-warning">Vacant</Badge>}
                      </div>
                      {people.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-expanded={shown}
                          aria-controls={shown ? `${key}-people` : undefined}
                          aria-label={shown ? `Hide people in ${position.title}` : `Show ${peopleWord(people.length)} in ${position.title}`}
                          onClick={() => toggle(key)}
                        >
                          {shown ? 'Hide' : `Show ${peopleWord(people.length)}`}
                        </Button>
                      )}
                    </div>
                    {shown && <PeopleList id={`${key}-people`} people={people} />}
                  </li>
                );
              })}
              {g.unplaced.length > 0 && (() => {
                const key = `unplaced-${g.id || 'none'}`;
                const shown = open.has(key);
                return (
                  <li className="py-1">
                    <div className="flex min-h-12 flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">No position set</span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-expanded={shown}
                        aria-controls={shown ? `${key}-people` : undefined}
                        aria-label={shown ? `Hide people with no position in ${g.name}` : `Show ${peopleWord(g.unplaced.length)} with no position in ${g.name}`}
                        onClick={() => toggle(key)}
                      >
                        {shown ? 'Hide' : `Show ${peopleWord(g.unplaced.length)}`}
                      </Button>
                    </div>
                    {shown && <PeopleList id={`${key}-people`} people={g.unplaced} />}
                  </li>
                );
              })()}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
