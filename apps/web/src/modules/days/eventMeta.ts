import { AlertOctagon, PackageX, Receipt, ShieldCheck, Tag, TrendingUp, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { BadgeProps } from '@repo/ui/shadcn/badge';

type EventVariant = NonNullable<BadgeProps['variant']>;

interface EventMeta {
  label: string;
  icon: LucideIcon;
  variant: EventVariant;
}

const KNOWN: Record<string, EventMeta> = {
  sales_spike: { label: 'sales spike', icon: TrendingUp, variant: 'signal' },
  vendor_delay: { label: 'vendor delay', icon: Truck, variant: 'warning' },
  damage_report: { label: 'damage report', icon: PackageX, variant: 'danger' },
  invoice_cost_change: { label: 'invoice cost change', icon: Receipt, variant: 'info' },
  promotion: { label: 'promotion', icon: Tag, variant: 'good' },
  manager_override: { label: 'manager override', icon: ShieldCheck, variant: 'muted' },
};

const FALLBACK: EventMeta = { label: 'unknown', icon: AlertOctagon, variant: 'muted' };

export const getEventMeta = (type: string): EventMeta =>
  KNOWN[type] ?? { ...FALLBACK, label: type };
