import { Link, useNavigate } from '@tanstack/react-router';
import { GitCompareArrows, X } from 'lucide-react';
import { motion } from 'motion/react';

import type { Run } from '@back-stock/api/runs';

import { Button } from '@repo/ui/shadcn/button';
import { cn } from '@repo/ui/utils';
import { COMPARE_MAX_RUNS, useCompareStore } from '@/modules/compare/store';
import { staggerContainer, staggerItem } from '@/modules/core/lib/motion';
import { EmptyPanel } from '@/modules/core/StatePanels';
import { buildRunTreeRows } from '@/modules/runs/tree/runTree.build';
import { ForkEdgeTag, RunTreeNode } from '@/modules/runs/tree/RunTreeNode';

interface RunTreeProps {
  runs: Run[];
}

export function RunTree({ runs }: RunTreeProps) {
  const rows = buildRunTreeRows(runs);
  const navigate = useNavigate();
  const selectedIds = useCompareStore((state) => state.runIds);
  const clear = useCompareStore((state) => state.clear);

  const selected = [...selectedIds];

  const goCompare = () => {
    if (selected.length < 2) return;
    void navigate({
      to: '/compare',
      search: {
        run_a: selected[0]!,
        run_b: selected[1]!,
        ...(selected[2] ? { run_c: selected[2] } : {}),
      },
    });
  };

  if (rows.length === 0) {
    return (
      <EmptyPanel
        title="No runs yet"
        message="Pick a version above and start a run to replay this day."
        testid="run-tree-empty"
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="run-tree">
      {selected.length > 0 ? (
        <div
          data-testid="run-tree-compare-bar"
          className="border-primary/30 bg-primary/[0.06] flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
        >
          <span className="text-foreground font-mono text-xs tabular-nums">
            {selected.length}/{COMPARE_MAX_RUNS} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clear()}
              data-testid="run-tree-compare-clear"
            >
              <X />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={goCompare}
              disabled={selected.length < 2}
              aria-disabled={selected.length < 2}
              data-testid="run-tree-compare-go"
            >
              <GitCompareArrows />
              Compare selected
            </Button>
          </div>
        </div>
      ) : null}

      <motion.ol
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2.5"
        data-testid="run-tree-graph"
      >
        {rows.map((row) => (
          <motion.li
            key={row.run.id}
            variants={staggerItem}
            className="flex items-stretch"
            data-testid={`run-tree-row-${row.run.id}`}
          >
            <BranchRails depth={row.depth} isLast={row.isLast} />
            <div className="min-w-0 flex-1 space-y-1">
              <RunTreeNode run={row.run} />
              {row.run.parent_run_id !== null ? <ForkEdgeTag run={row.run} /> : null}
            </div>
          </motion.li>
        ))}
      </motion.ol>

      <p className="text-muted-foreground/70 text-[11px]">
        Click a node to replay it. Select 2–3 nodes to{' '}
        <Link
          to="/compare"
          className="text-foreground hover:text-primary underline-offset-2 hover:underline"
        >
          compare
        </Link>{' '}
        their outcomes.
      </p>
    </div>
  );
}

/**
 * Vertical rails + an elbow connector for branch nodes, drawn purely with
 * borders so lineage survives variable row heights without DOM measurement.
 */
function BranchRails({ depth, isLast }: { depth: number; isLast: boolean }) {
  if (depth === 0) return null;
  const lanes = Array.from({ length: depth - 1 });
  return (
    <div className="flex shrink-0" aria-hidden>
      {lanes.map((_, idx) => (
        <span key={idx} className="block w-7 border-l border-[var(--info)]/25" />
      ))}
      <span className="relative block w-7">
        <span
          className={cn(
            'absolute top-0 left-0 w-px bg-[var(--info)]/35',
            isLast ? 'h-[calc(50%+2px)]' : 'h-full'
          )}
        />
        <span className="absolute top-[calc(50%+2px)] left-0 h-px w-full bg-[var(--info)]/35" />
      </span>
    </div>
  );
}
