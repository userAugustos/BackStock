import { createFileRoute } from '@tanstack/react-router';

import { Badge } from '@repo/ui/shadcn/badge';
import { useCompareStore } from '@/modules/compare/store';
import { shortId } from '@/modules/core/lib/format';
import { PhaseStub } from '@/modules/core/PhaseStub';

export const Route = createFileRoute('/compare')({
  component: CompareStub,
});

function CompareStub() {
  const runIds = useCompareStore((state) => state.runIds);
  const selected = [...runIds];

  return (
    <PhaseStub
      phase="Phase 5C"
      title="Compare runs"
      description="Side-by-side timeline alignment and impact deltas arrive in the next phase."
      testid="compare-stub"
    >
      {selected.length > 0 ? (
        <div
          className="flex flex-wrap items-center justify-center gap-1.5"
          data-testid="compare-selected"
        >
          {selected.map((id) => (
            <Badge key={id} variant="signal" className="font-mono">
              {shortId(id)}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs" data-testid="compare-empty">
          Select runs from a day to queue them for comparison.
        </p>
      )}
    </PhaseStub>
  );
}
