import { FilterX } from 'lucide-react';

import type { IgnoredEvent } from '@back-stock/api/days';

import { Badge } from '@repo/ui/shadcn/badge';

interface IgnoredReportProps {
  report: IgnoredEvent[] | null;
  testid?: string;
}

export function IgnoredReport({ report, testid = 'ignored-report' }: IgnoredReportProps) {
  if (!report || report.length === 0) {
    return (
      <div data-testid={`${testid}-empty`} className="text-muted-foreground text-sm">
        No events ignored: all events were recognized.
      </div>
    );
  }

  return (
    <div data-testid={testid} className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <FilterX className="size-4 text-[var(--warning)]" />
        <span className="font-medium">
          <span data-testid={`${testid}-count`} className="font-mono tabular-nums">
            {report.length}
          </span>{' '}
          event{report.length === 1 ? '' : 's'} ignored
        </span>
      </div>
      <ul className="space-y-1.5">
        {report.map((entry) => (
          <li
            key={entry.original_seq}
            className="bg-foreground/[0.025] ring-border/40 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ring-1"
          >
            <Badge variant="muted" className="font-mono">
              seq {entry.original_seq}
            </Badge>
            <span className="text-foreground font-mono">{entry.type}</span>
            <span className="text-muted-foreground">{entry.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
