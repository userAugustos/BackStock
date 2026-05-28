import { Link } from '@tanstack/react-router';
import { ArrowLeft, Boxes, CalendarClock, Zap } from 'lucide-react';

import type { DayDetail } from '@back-stock/api/days';

import { Badge } from '@repo/ui/shadcn/badge';
import { Button } from '@repo/ui/shadcn/button';
import { formatDateTime, formatNumber, shortId } from '@/modules/core/lib/format';

interface DayHeaderProps {
  day: DayDetail;
}

export function DayHeader({ day }: DayHeaderProps) {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/" data-testid="back-to-days">
          <ArrowLeft />
          All days
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={day.source === 'seed' ? 'signal' : 'muted'}>{day.source}</Badge>
            <span className="text-muted-foreground font-mono text-xs">{shortId(day.id)}</span>
          </div>
          <h1
            data-testid="day-title"
            className="font-display text-3xl font-extrabold tracking-tight"
          >
            {day.name}
          </h1>
          <p className="text-muted-foreground inline-flex items-center gap-1.5 font-mono text-xs">
            <CalendarClock className="size-3.5" />
            uploaded {formatDateTime(day.created_at)}
          </p>
        </div>

        <dl className="flex gap-3">
          <HeaderStat icon={<Boxes className="size-4" />} label="SKUs" value={day.sku_count} />
          <HeaderStat icon={<Zap className="size-4" />} label="Events" value={day.event_count} />
        </dl>
      </div>
    </div>
  );
}

function HeaderStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card rounded-xl px-4 py-2.5 shadow-[var(--elevation-1)] ring-1 ring-white/[0.04]">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[11px] tracking-wider uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">
        {formatNumber(value)}
      </dd>
    </div>
  );
}
