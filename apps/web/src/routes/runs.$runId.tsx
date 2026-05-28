import { createFileRoute } from '@tanstack/react-router';

import { Badge } from '@repo/ui/shadcn/badge';
import { shortId } from '@/modules/core/lib/format';
import { PhaseStub } from '@/modules/core/PhaseStub';

export const Route = createFileRoute('/runs/$runId')({
  component: RunDetailStub,
});

function RunDetailStub() {
  const { runId } = Route.useParams();
  return (
    <PhaseStub
      phase="Phase 5B"
      title="Run inspector"
      description="Timeline, agent decisions, and impact for this run land in the next phase."
      testid="run-detail-stub"
    >
      <Badge variant="muted" className="font-mono" data-testid="run-detail-id">
        run {shortId(runId)}
      </Badge>
    </PhaseStub>
  );
}
