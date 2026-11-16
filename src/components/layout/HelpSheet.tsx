/**
 * Help button's sheet: 3–5 short tips for the current page area
 * (routeContext → help.tips.<area> in the locale files).
 * TODO-help: the tips are placeholders — HR should replace them with real
 * guidance for each page.
 * Ends with the HR support line when Settings → Company has a phone number
 * (this used to be the "Lost?" strip on Home).
 */
import { useTranslation } from 'react-i18next';
import { useCollection } from '@/lib/db';
import type { Settings } from '@/lib/types';
import { CircleHelp, X } from 'lucide-react';
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import type { HelpArea } from './nav';

export default function HelpSheet({
  open,
  onOpenChange,
  area,
  pageTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: HelpArea;
  pageTitle: string;
}) {
  const { t } = useTranslation();
  const tips = t(`help.tips.${area}`, { returnObjects: true }) as string[];
  const { items: settings } = useCollection<Settings>('settings');
  const phone = settings[0]?.hrSupportPhone?.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showClose={false} className="w-full gap-6 overflow-y-auto p-6 sm:max-w-lg">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-3 text-[1.5rem] font-bold">
            <CircleHelp className="size-8 shrink-0 text-warning" aria-hidden="true" />
            {t('help.title')}
          </SheetTitle>
          <SheetDescription className="text-base">{pageTitle}</SheetDescription>
        </SheetHeader>
        <ol className="flex list-decimal flex-col gap-4 pl-6 text-[1.1rem]">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ol>
        {phone && <p className="border-t pt-4 text-[1.1rem]">{t('help.hrSupport', { ext: phone })}</p>}
        <SheetClose className="mt-auto inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[6px] border-2 border-primary bg-card px-6 text-[1.05rem] font-bold text-primary hover:bg-accent">
          <X className="size-5" aria-hidden="true" />
          {t('help.close')}
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
