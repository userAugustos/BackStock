import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Boxes, CalendarClock, Zap } from 'lucide-react';

import type { DayListItem } from '@back-stock/api/days';

import { Badge } from '@repo/ui/shadcn/badge';
import { Card } from '@repo/ui/shadcn/card';
import { formatDateTime, formatNumber } from '@/modules/core/lib/format';

interface DayCardProps {
  day: DayListItem;
}

export function DayCard({ day }: DayCardProps) {
  return (
    <Card className="group hover:ring-primary/30 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--elevation-3)]">
      <Link
        to="/days/$dayId"
        params={{ dayId: day.id }}
        data-testid={`day-card-${day.id}`}
        className="focus-visible:ring-ring block rounded-2xl p-5 transition-transform duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.985]"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base leading-snug font-bold tracking-tight text-balance">
            {day.name}
          </h3>
          <span
            aria-hidden
            className="group-hover:bg-primary/10 group-hover:text-primary text-muted-foreground -mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Badge variant={day.source === 'seed' ? 'signal' : 'muted'}>{day.source}</Badge>
          <span className="text-muted-foreground inline-flex items-center gap-1 font-mono text-xs">
            <CalendarClock className="size-3" />
            {formatDateTime(day.created_at)}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Stat icon={<Boxes className="size-3.5" />} label="SKUs" value={day.sku_count} />
          <Stat icon={<Zap className="size-3.5" />} label="Events" value={day.event_count} />
        </dl>
      </Link>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-foreground/[0.025] ring-border/40 rounded-lg px-3 py-2 ring-1">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[11px] tracking-wider uppercase">
        {icon}
        {label}
      </dt>
      <dd className="text-foreground mt-0.5 font-mono text-lg font-semibold tabular-nums">
        {formatNumber(value)}
      </dd>
    </div>
  );
}
