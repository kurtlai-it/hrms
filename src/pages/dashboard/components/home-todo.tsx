/**
 * Home "Waiting for you · <date>": the page heading and the work under it,
 * one line per job (what is waiting + one amber button that says what it
 * does), at most 3, then "See all". No panel, no numbered circles. The phone To do button links here (#todo), so the section
 * scrolls into view when the hash asks for it.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/i18n';
import { useHomeTodos } from '../useHomeTodos';
import { MAX_HOME_TODOS } from '../homeTodos';

export function HomeTodo() {
  const { t } = useTranslation();
  const todos = useHomeTodos();
  const { hash } = useLocation();
  const [today] = useState(() => new Date());
  const [all, setAll] = useState(false);
  const shown = all ? todos : todos.slice(0, MAX_HOME_TODOS);

  useEffect(() => {
    if (hash === '#todo') document.getElementById('todo')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <section id="todo" aria-labelledby="home-todo" className="scroll-mt-28">
      <h1 id="home-todo" className="pb-2 text-[1.45rem] font-bold leading-tight">
        {t('home.waitingFor', { date: formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }) })}
      </h1>
      {todos.length === 0 ? (
        <p className="border-y py-3">{t('home.nothing')}</p>
      ) : (
        // One grid for all rows (subgrid): the button column is as wide as the
        // widest button, so every button has the same width and right edge in
        // any language or text size.
        <ul id="home-todo-list" className="grid grid-cols-[minmax(0,1fr)_max-content] divide-y border-y">
          {shown.map((todo) => (
            <li key={todo.id} className="col-span-2 grid grid-cols-subgrid items-center gap-x-4 py-2">
              <span className="min-w-0">{todo.text}</span>
              <Button asChild className="w-full min-w-[6.5rem] px-6">
                <Link to={todo.href} aria-label={`${todo.action}: ${todo.text}`}>
                  {todo.action}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {todos.length > MAX_HOME_TODOS && (
        <Button
          variant="outline"
          className="mt-3"
          aria-expanded={all}
          aria-controls="home-todo-list"
          onClick={() => setAll((v) => !v)}
        >
          {all ? t('home.showFewer') : t('home.showAll', { count: todos.length })}
        </Button>
      )}
    </section>
  );
}
