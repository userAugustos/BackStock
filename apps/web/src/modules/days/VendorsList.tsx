import { Truck } from 'lucide-react';

import type { SeedState } from '@back-stock/api/days';

import { formatNumber } from '@/modules/core/lib/format';

interface VendorsListProps {
  seedState: SeedState;
}

export function VendorsList({ seedState }: VendorsListProps) {
  return (
    <ul data-testid="vendors-list" className="space-y-2">
      {seedState.vendors.map((vendor) => (
        <li
          key={vendor.id}
          data-testid={`vendor-row-${vendor.id}`}
          className="bg-foreground/[0.025] ring-border/40 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1"
        >
          <span className="text-foreground inline-flex items-center gap-2 font-mono text-sm">
            <Truck className="text-muted-foreground size-4" />
            {vendor.id}
          </span>
          <span className="text-muted-foreground flex items-center gap-4 font-mono text-xs tabular-nums">
            <span>lead {formatNumber(vendor.lead_time_hours)}h</span>
            <span>next {vendor.next_delivery_at}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
