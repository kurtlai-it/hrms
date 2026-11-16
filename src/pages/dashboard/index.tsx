/**
 * Home screen (route '/'). The greeting and the company name are in the
 * header band (AppLayout). The page leads with the work:
 *  1. "Waiting for you · <date>" — the page heading, up to 3 jobs, most
 *     urgent first, each with a button that says what it does (useHomeTodos).
 *  2. "My numbers" — Employee and Manager only, one plain line.
 *  3. "Go to" and the icon grid (AppGrid): most pages one press away, the
 *     rest behind "More".
 * The old dashboard figures and charts live on the Reports page
 * (pages/reports/overview).
 */
import { useTranslation } from 'react-i18next';
import { AppGrid } from './components/app-grid';
import { HomeTodo } from './components/home-todo';
import { MyNumbers } from './components/my-numbers';

export default function DashboardPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <HomeTodo />
      <MyNumbers />
      <section aria-labelledby="home-goto" className="space-y-3 pt-2">
        <h2 id="home-goto" className="border-b pb-2 text-[1.2rem] font-bold">{t('app.goTo')}</h2>
        <AppGrid />
      </section>
    </div>
  );
}
