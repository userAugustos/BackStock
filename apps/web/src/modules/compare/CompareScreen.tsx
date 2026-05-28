import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, BarChart3, GitFork, ListTree, Trophy } from 'lucide-react';
import { m } from 'motion/react';

import type { CompareResult, CompareRunMeta } from '@back-stock/api/compare';

import { Badge } from '@repo/ui/shadcn/badge';
import { Button } from '@repo/ui/shadcn/button';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/shadcn/card';
import { AlignedTimeline } from '@/modules/compare/AlignedTimeline';
import { ImpactBarChart } from '@/modules/compare/ImpactBarChart';
import { ImpactScoreboard } from '@/modules/compare/ImpactScoreboard';
import { buildRunColors } from '@/modules/compare/runColors';
import { shortId } from '@/modules/core/lib/format';
import { staggerContainer, staggerItem } from '@/modules/core/lib/motion';
import { dayDetailQueryOptions } from '@/modules/days/days.queries';
import { versionsListQueryOptions } from '@/modules/versions/versions.queries';
import type { RunColor } from '@/modules/compare/runColors';

interface CompareScreenProps {
  result: CompareResult;
}

export function CompareScreen({ result }: CompareScreenProps) {
  const colors = buildRunColors(result.runs);

  return (
    <m.div
      data-testid="compare-screen"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <m.div variants={staggerItem}>
        <CompareHeader result={result} colors={colors} />
      </m.div>

      <m.div variants={staggerItem}>
        <Card data-testid="scoreboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="text-primary size-4" />
              Impact scoreboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImpactScoreboard result={result} colors={colors} />
          </CardContent>
        </Card>
      </m.div>

      <m.div variants={staggerItem}>
        <Card data-testid="bar-chart-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="text-primary size-4" />
              Outcome comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImpactBarChart result={result} colors={colors} />
          </CardContent>
        </Card>
      </m.div>

      <m.div variants={staggerItem}>
        <Card data-testid="aligned-timeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTree className="text-primary size-4" />
              Aligned timeline
              <span className="text-muted-foreground text-xs font-normal">
                inventory per step · decision diffs highlighted
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlignedTimeline result={result} colors={colors} />
          </CardContent>
        </Card>
      </m.div>
    </m.div>
  );
}

function CompareHeader({
  result,
  colors,
}: {
  result: CompareResult;
  colors: Map<string, RunColor>;
}) {
  const dayQuery = useQuery(dayDetailQueryOptions(result.day_id));

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link to="/days/$dayId" params={{ dayId: result.day_id }} data-testid="compare-back-to-day">
          <ArrowLeft />
          {dayQuery.data ? dayQuery.data.name : 'Back to day'}
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Compare runs</h1>
        <p
          data-testid="compare-divergence-callout"
          className="text-muted-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <GitFork className="size-4 text-[var(--info)]" />
          {result.divergence_seq > 0 ? (
            <>
              Identical through step{' '}
              <span className="text-foreground font-mono tabular-nums">
                {result.divergence_seq}
              </span>
              , then diverge.
            </>
          ) : (
            <>These runs diverge from the start.</>
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.runs.map((run) => (
          <RunColumn key={run.run_id} run={run} color={colors.get(run.run_id)} />
        ))}
      </div>
    </div>
  );
}

function RunColumn({ run, color }: { run: CompareRunMeta; color?: RunColor }) {
  const versionsQuery = useQuery(versionsListQueryOptions());
  const versionLabel =
    versionsQuery.data?.find((version) => version.id === run.version_id)?.label ??
    shortId(run.version_id);
  const isBranch = run.parent_run_id !== null;

  return (
    <div
      data-testid={`compare-run-column-${run.run_id}`}
      className="bg-card relative overflow-hidden rounded-2xl p-4 ring-1 ring-white/[0.06]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: color?.cssVar }}
      />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ backgroundColor: color?.cssVar }}
        />
        <Link
          to="/runs/$runId"
          params={{ runId: run.run_id }}
          data-testid={`compare-run-link-${run.run_id}`}
          className="text-foreground hover:text-primary font-mono text-sm underline-offset-2 hover:underline"
        >
          {shortId(run.run_id)}
        </Link>
      </div>

      <p className="text-muted-foreground mt-2 text-xs">
        {run.label ?? (isBranch ? 'branch' : 'root run')}
      </p>

      {isBranch && run.parent_run_id ? (
        <p
          data-testid={`compare-lineage-${run.run_id}`}
          className="text-muted-foreground/80 mt-1 inline-flex items-center gap-1 font-mono text-[11px]"
        >
          <GitFork className="size-3" />
          from{' '}
          <Link
            to="/runs/$runId"
            params={{ runId: run.parent_run_id }}
            className="text-foreground hover:text-primary underline-offset-2 hover:underline"
          >
            {shortId(run.parent_run_id)}
          </Link>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className="font-mono"
          data-testid={`compare-version-${run.run_id}`}
        >
          {versionLabel}
        </Badge>
        {isBranch ? (
          <Badge variant="info" className="font-mono" data-testid={`compare-fork-${run.run_id}`}>
            <GitFork />
            fork@{run.fork_event_seq}
          </Badge>
        ) : (
          <Badge variant="muted" className="font-mono">
            trunk
          </Badge>
        )}
      </div>
    </div>
  );
}
