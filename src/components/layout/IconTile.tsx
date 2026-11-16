/**
 * The app's navigation tile (Home grid, "More" page, group pages): an 80px
 * soft circle with a two-tone icon and the label under it, on plain white —
 * no border, no box. The whole tile is the link (at least 96px tall; every
 * tile in a grid row is as tall as the tallest). A waiting count shows as a
 * small red badge on the circle and is said in words for screen readers.
 */
import { Link } from 'react-router-dom';
import type { PageIcon } from './pageIcons';

export const tileClass =
  'flex h-full min-h-[96px] w-full flex-col items-center gap-2 rounded-md px-1 py-2 text-center text-foreground transition-colors hover:bg-accent';

/** Grid for tiles: 3 columns on phones, 4 to 5 on wider screens. */
export const tileGridClass = 'mx-auto grid w-full max-w-[1100px] grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 lg:grid-cols-5';

export function TileBody({ label, icon: Icon, count, waiting }: { label: string; icon: PageIcon; count?: number; waiting?: string }) {
  return (
    <>
      <span className="relative flex size-20 items-center justify-center rounded-full bg-tile">
        <Icon weight="duotone" className="duo-icon size-11" aria-hidden="true" />
        {count ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-background bg-count px-1.5 text-[0.9rem] font-bold leading-none text-count-foreground"
          >
            {count}
          </span>
        ) : null}
      </span>
      <span className="text-[1rem] font-bold leading-tight">
        {label}
        {/* The badge number is hidden from screen readers; this says it in words. */}
        {waiting ? <span className="sr-only">{waiting}</span> : null}
      </span>
    </>
  );
}

export function IconTile({ to, label, icon, count, waiting }: { to: string; label: string; icon: PageIcon; count?: number; waiting?: string }) {
  return (
    <Link to={to} className={tileClass}>
      <TileBody label={label} icon={icon} count={count} waiting={waiting} />
    </Link>
  );
}
