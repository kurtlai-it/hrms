/**
 * One Phosphor duotone icon per page, shared by the Home grid, the "More"
 * page and the group pages (Phosphor Icons, MIT licence). Drawn two-tone with
 * the .duo-icon class (indigo outline + amber fill, src/index.css).
 */
import type { ComponentType } from 'react';
import {
  Buildings, Calculator, CalendarCheck, CalendarStar, ChartBar, ChartLineUp, ClockUser, FileText, GearSix,
  HandCoins, Invoice, Receipt, ShieldCheck, SquaresFour, Stamp, Star, TreeStructure, TreeView, UserMinus, UserPlus,
  UsersThree, type IconProps,
} from '@phosphor-icons/react';

export type PageIcon = ComponentType<IconProps>;

export const PAGE_ICONS: Record<string, PageIcon> = {
  '/approvals': Stamp,
  '/employees': UsersThree,
  '/onboarding': UserPlus,
  '/offboarding': UserMinus,
  '/contracts': FileText,
  '/leave': CalendarCheck,
  '/attendance': ClockUser,
  '/holidays': CalendarStar,
  '/payroll': Calculator,
  '/payroll/batch-payslips': Invoice,
  '/my-payslips': Invoice,
  '/loans': HandCoins,
  '/claims': Receipt,
  '/reports': ChartBar,
  '/kpi': Star,
  '/insights/salary': ChartLineUp,
  '/company': Buildings,
  '/org': TreeStructure,
  '/org/chart': TreeView,
  '/settings': GearSix,
  '/superadmin': ShieldCheck,
  '/more': SquaresFour,
};

/** The page's icon, or the "More" icon for anything not listed. */
export function pageIcon(path: string): PageIcon {
  return PAGE_ICONS[path] ?? SquaresFour;
}
