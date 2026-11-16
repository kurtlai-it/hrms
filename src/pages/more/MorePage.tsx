/**
 * "More" page (/more): every page this session may open, grouped like the
 * group pages, as the same icon tiles as Home. Home → More → page is the
 * longest path to any page (2 presses). Approvals are listed first when the
 * role can open them (they are in no group).
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';
import { useEffectiveRole } from '@/components/layout/useEffectiveRole';
import { visibleHomeGroups, visibleNavItems } from '@/components/layout/nav';
import { IconTile, tileGridClass } from '@/components/layout/IconTile';
import { pageIcon } from '@/components/layout/pageIcons';

export default function MorePage() {
  const { t } = useTranslation();
  const { role } = useEffectiveRole();
  const { isSuperAdmin } = useAuth();
  const canOpen = new Set(visibleNavItems(role, isSuperAdmin).map((i) => i.path));
  const groups = visibleHomeGroups(role, isSuperAdmin);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
      <h1 className="text-center text-[1.45rem] font-bold leading-tight">{t('app.allPages')}</h1>
      {canOpen.has('/approvals') && (
        <section aria-labelledby="more-approvals" className="space-y-3">
          <h2 id="more-approvals" className="border-b pb-2 text-[1.2rem] font-bold">
            {t('nav.approvals')}
          </h2>
          <ul className={tileGridClass}>
            <li>
              <IconTile to="/approvals" label={t('nav.approvals')} icon={pageIcon('/approvals')} />
            </li>
          </ul>
        </section>
      )}
      {groups.map(({ group, pages }) => (
        <section key={group.key} aria-labelledby={`more-${group.key}`} className="space-y-3">
          <h2 id={`more-${group.key}`} className="border-b pb-2 text-[1.2rem] font-bold">
            {t(`group.${group.key}`)}
          </h2>
          <ul className={tileGridClass}>
            {pages.map((p) => (
              <li key={p.path}>
                <IconTile to={p.path} label={t(`page.${p.pageKey}.name`)} icon={pageIcon(p.path)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
