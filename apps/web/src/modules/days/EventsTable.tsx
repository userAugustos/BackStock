import type { DayEvent } from '@back-stock/api/days';

import { Badge } from '@repo/ui/shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/shadcn/table';
import { getEventMeta } from '@/modules/days/eventMeta';

interface EventsTableProps {
  events: DayEvent[];
}

const formatPayloadValue = (value: unknown): string => {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const summarizePayload = (payload: Record<string, unknown>): string =>
  Object.entries(payload)
    .map(([key, value]) => `${key}=${formatPayloadValue(value)}`)
    .join('  ');

export function EventsTable({ events }: EventsTableProps) {
  return (
    <Table data-testid="events-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">Seq</TableHead>
          <TableHead className="w-16">At</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Payload</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => {
          const meta = getEventMeta(event.type);
          const Icon = meta.icon;
          return (
            <TableRow key={event.id} data-testid={`event-row-${event.seq}`}>
              <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                {event.seq}
              </TableCell>
              <TableCell className="text-muted-foreground font-mono tabular-nums">
                {event.at}
              </TableCell>
              <TableCell>
                <Badge variant={meta.variant}>
                  <Icon />
                  <span className="font-mono">{event.type}</span>
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground max-w-md truncate font-mono text-xs">
                {summarizePayload(event.payload)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
