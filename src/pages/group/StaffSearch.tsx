/**
 * Big "Find a staff member" search box at the top of the Staff group page
 * (replaces the old top-bar global search). Matches name, email, IC and staff
 * number within the session's employee scope; Enter opens the first match.
 */
import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Search } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useCollection } from '@/lib/db';
import type { Employee } from '@/lib/types';

const MAX_RESULTS = 8;

export default function StaffSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputId = useId();
  const { scopeEmployees } = useAuth();
  const { items: employees } = useCollection<Employee>('employees');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return scopeEmployees(employees)
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.ic.toLowerCase().includes(q) ||
          (e.employeeNo ?? '').toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [q, employees, scopeEmployees]);

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block text-[1.25rem] font-bold">
        {t('page.findStaff.name')}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) navigate(`/employees/${results[0].id}`);
          }}
          placeholder={t('search.staffPlaceholder')}
          autoComplete="off"
          className="h-14 w-full rounded-lg border-2 border-input bg-card pl-14 pr-4 text-[1.1rem] text-card-foreground placeholder:text-muted-foreground"
        />
      </div>
      {q && (
        <div aria-live="polite">
          {results.length === 0 ? (
            <p className="text-muted-foreground">{t('search.noResults', { query: query.trim() })}</p>
          ) : (
            <ul aria-label={t('search.results')} className="divide-y overflow-hidden rounded-lg border-2 border-input bg-card">
              {results.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/employees/${e.id}`}
                    className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{e.name}</span>
                      <span className="block break-words text-muted-foreground">
                        {[e.employeeNo, e.email].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronRight className="size-6 shrink-0 text-primary" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
