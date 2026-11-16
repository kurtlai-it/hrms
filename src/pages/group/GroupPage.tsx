/**
 * Group page (/go/:groupKey) — the second and last level of navigation:
 * breadcrumb, heading, "Choose one:", then one icon tile per page the session
 * can open (same tiles as Home). Unknown or empty groups go back Home; a group with a single
 * visible page goes straight to it (deep links included).
 */
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';
import { isGroupKey, visibleHomeGroups } from '@/components/layout/nav';
import { useEffectiveRole } from '@/components/layout/useEffectiveRole';
import { IconTile, tileGridClass } from '@/components/layout/IconTile';
import { pageIcon } from '@/components/layout/pageIcons';
import StaffSearch from './StaffSearch';

export default function GroupPage() {
  const { t } = useTranslation();
  const { groupKey } = useParams();
  const { role } = useEffectiveRole();
  const { isSuperAdmin } = useAuth();

  const visible = isGroupKey(groupKey)
    ? visibleHomeGroups(role, isSuperAdmin).find((g) => g.group.key === groupKey)
    : undefined;
  if (!visible) return <Navigate to="/" replace />;
  if (visible.pages.length === 1) return <Navigate to={visible.pages[0]!.path} replace />;

  const name = t(`group.${visible.group.key}`);
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <nav aria-label={t('a11y.breadcrumb')}>
        <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
          <li>
            <Link to="/" className="inline-flex min-h-12 items-center underline-offset-4 hover:underline">
              {t('bar.home')}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>

      <h1 className="text-[1.6rem] font-bold leading-tight">{name}</h1>

      {visible.group.key === 'staff' && <StaffSearch />}

      <p className="m-0 text-[1.1rem]">{t('home.pick')}</p>
      <ul className={tileGridClass}>
        {visible.pages.map((p) => (
          <li key={p.path}>
            <IconTile to={p.path} label={t(`page.${p.pageKey}.name`)} icon={pageIcon(p.path)} />
          </li>
        ))}
      </ul>

    </div>
  );
}
