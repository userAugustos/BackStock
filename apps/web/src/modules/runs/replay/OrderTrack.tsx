import { ArrowRight } from 'lucide-react';
import { m } from 'motion/react';

import type { OrderState, OrderStatus } from '@back-stock/api/simulation';

import { cn } from '@repo/ui/utils';
import { formatNumber } from '@/modules/core/lib/format';
import { EmptyPanel } from '@/modules/core/StatePanels';

interface OrderTrackProps {
  orders: OrderState[];
}

const FSM_FLOW: OrderStatus[] = ['recommended', 'placed', 'in_transit', 'delivered'];

const STATUS_TONE: Record<OrderStatus, string> = {
  recommended: 'bg-muted text-muted-foreground ring-white/[0.06]',
  placed: 'bg-[var(--info)]/15 text-[var(--info)] ring-[var(--info)]/30',
  in_transit: 'bg-[var(--info)]/15 text-[var(--info)] ring-[var(--info)]/30',
  delivered: 'bg-primary/15 text-primary ring-primary/30',
  late: 'bg-[var(--warning)]/15 text-[var(--warning)] ring-[var(--warning)]/30',
  rejected: 'bg-[var(--danger)]/15 text-[var(--danger)] ring-[var(--danger)]/30',
  missed: 'bg-[var(--danger)]/15 text-[var(--danger)] ring-[var(--danger)]/30',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  recommended: 'recommended',
  placed: 'placed',
  in_transit: 'in transit',
  delivered: 'delivered',
  late: 'late',
  rejected: 'rejected',
  missed: 'missed',
};

function flowFor(status: OrderStatus): OrderStatus[] {
  if (status === 'rejected') return ['recommended', 'rejected'];
  if (status === 'missed') return ['recommended', 'placed', 'in_transit', 'late', 'missed'];
  if (status === 'late') return ['recommended', 'placed', 'in_transit', 'late'];
  return FSM_FLOW;
}

export function OrderTrack({ orders }: OrderTrackProps) {
  if (orders.length === 0) {
    return (
      <EmptyPanel
        title="No orders yet"
        message="Order recommendations appear once an agent reacts to demand."
        testid="order-track-empty"
      />
    );
  }

  return (
    <ul className="space-y-3" data-testid="order-track">
      {orders.map((order, idx) => {
        const flow = flowFor(order.status);
        const activeIndex = flow.indexOf(order.status);
        return (
          <m.li
            key={`${order.sku_id}-${order.vendor_id}-${order.created_at_seq}-${idx}`}
            layout
            data-testid={`order-row-${order.sku_id}-${order.created_at_seq}`}
            className="bg-background/40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-3 py-2.5 ring-1 ring-white/[0.05]"
          >
            <div className="min-w-0 font-mono text-xs">
              <span className="text-foreground">{order.sku_id}</span>
              <span className="text-muted-foreground"> · {order.vendor_id}</span>
              <span className="text-muted-foreground"> · {formatNumber(order.quantity)}u</span>
            </div>

            <div className="flex items-center gap-1">
              {flow.map((node, nodeIdx) => {
                const reached = nodeIdx <= activeIndex;
                const isCurrent = nodeIdx === activeIndex;
                return (
                  <div key={node} className="flex items-center gap-1">
                    <span
                      data-testid={
                        isCurrent
                          ? `order-node-active-${order.sku_id}-${order.created_at_seq}`
                          : undefined
                      }
                      className={cn(
                        'rounded-md px-2 py-0.5 font-mono text-[10px] ring-1 transition-colors',
                        reached
                          ? STATUS_TONE[node]
                          : 'bg-background/30 text-muted-foreground/40 ring-white/[0.04]',
                        isCurrent && 'shadow-[var(--elevation-1)]'
                      )}
                    >
                      {STATUS_LABEL[node]}
                    </span>
                    {nodeIdx < flow.length - 1 ? (
                      <ArrowRight
                        className={cn(
                          'size-3',
                          reached ? 'text-muted-foreground' : 'text-muted-foreground/30'
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </m.li>
        );
      })}
    </ul>
  );
}
