import type { ForkChange } from '@back-stock/api/simulation';

import { formatCurrency, formatNumber, shortId } from '@/modules/core/lib/format';

export function describeForkChange(change: ForkChange | null): string {
  if (!change) return 'forked run';
  if (change.type === 'version') return `version → ${shortId(change.version_id)}`;
  const decision = change.decision;
  if (decision.agent === 'inventory') {
    return `override ${decision.sku_id} → ${formatNumber(decision.order_cases)} cases`;
  }
  return `override ${decision.sku_id} → ${formatCurrency(decision.new_price)}`;
}
