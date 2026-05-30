import { AlertTriangle, Boxes, CheckCircle2, GitBranch, Tag } from 'lucide-react';
import { m } from 'motion/react';

import type { RunDecision } from '@back-stock/api/runs';

import { Badge } from '@repo/ui/shadcn/badge';
import { Button } from '@repo/ui/shadcn/button';
import { Separator } from '@repo/ui/shadcn/separator';
import type { BadgeProps } from '@repo/ui/shadcn/badge';
import { formatCurrency, formatNumber } from '@/modules/core/lib/format';
import { TryAlternativeDialog } from '@/modules/runs/replay/TryAlternativeDialog';

interface DecisionCardProps {
  runId: string;
  decision: RunDecision;
}

const SOURCE_VARIANT: Record<RunDecision['source'], NonNullable<BadgeProps['variant']>> = {
  llm: 'info',
  stub: 'muted',
  override: 'signal',
  reused: 'outline',
  failure: 'danger',
};

const cardEnter = {
  initial: { opacity: 0, y: 12, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
  transition: { type: 'spring' as const, duration: 0.3, bounce: 0 },
};

export function DecisionCard({ runId, decision }: DecisionCardProps) {
  const isInventory = decision.agent === 'inventory';
  const AgentIcon = isInventory ? Boxes : Tag;

  return (
    <m.div
      key={decision.event_seq}
      data-testid="decision-card"
      data-valid={decision.valid}
      initial={cardEnter.initial}
      animate={cardEnter.animate}
      exit={cardEnter.exit}
      transition={cardEnter.transition}
      className="bg-card rounded-2xl p-5 shadow-[var(--elevation-2)] ring-1 ring-white/[0.06]"
    >
      <m.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="space-y-4"
      >
        <m.div
          variants={itemVariants}
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Badge variant={isInventory ? 'signal' : 'info'} data-testid="decision-agent">
              <AgentIcon />
              {decision.agent} agent
            </Badge>
            <Badge variant={SOURCE_VARIANT[decision.source]} data-testid="decision-source">
              {decision.source}
            </Badge>
            {decision.valid ? (
              <Badge variant="good" data-testid="decision-valid">
                <CheckCircle2 />
                valid
              </Badge>
            ) : (
              <Badge variant="danger" data-testid="decision-invalid">
                <AlertTriangle />
                invalid
              </Badge>
            )}
          </div>
          <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
            event #{decision.event_seq} · {formatNumber(decision.latency_ms)}ms
          </span>
        </m.div>

        <m.div variants={itemVariants} className="flex flex-wrap gap-3 font-mono text-[11px]">
          <span className="text-muted-foreground">
            prompt <span className="text-foreground">{decision.prompt_version}</span>
          </span>
          <span className="text-muted-foreground">
            model <span className="text-foreground">{decision.model_id}</span>
          </span>
        </m.div>

        <m.div
          variants={itemVariants}
          data-testid="decision-parsed"
          className="bg-background/50 rounded-xl px-4 py-3 ring-1 ring-white/[0.06]"
        >
          {decision.parsed.agent === 'inventory' ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground text-xs tracking-wide uppercase">order</span>
              <span className="font-mono text-sm tabular-nums">
                <span className="text-primary text-lg font-semibold">
                  {formatNumber(decision.parsed.order_cases)}
                </span>{' '}
                cases · <span className="text-foreground">{decision.parsed.sku_id}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                new price
              </span>
              <span className="font-mono text-sm tabular-nums">
                <span className="text-primary text-lg font-semibold">
                  {formatCurrency(decision.parsed.new_price)}
                </span>{' '}
                · <span className="text-foreground">{decision.parsed.sku_id}</span>
              </span>
            </div>
          )}
        </m.div>

        <m.p
          variants={itemVariants}
          data-testid="decision-reasoning"
          className="text-muted-foreground text-sm leading-relaxed"
        >
          {decision.reasoning}
        </m.p>

        <Separator />

        <m.div variants={itemVariants}>
          <TryAlternativeDialog
            runId={runId}
            decision={decision}
            trigger={
              <Button type="button" variant="outline" size="sm" data-testid="try-alternative-open">
                <GitBranch />
                Try alternative
              </Button>
            }
          />
        </m.div>
      </m.div>
    </m.div>
  );
}

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, duration: 0.25, bounce: 0 } },
};
