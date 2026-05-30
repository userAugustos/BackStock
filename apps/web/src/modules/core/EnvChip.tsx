import { Badge } from '@repo/ui/shadcn/badge';
import { webEnv } from '@/modules/core/lib/env';

export function EnvChip() {
  const label = webEnv.app.isProduction ? 'prod' : webEnv.app.isDevelopment ? 'dev' : 'test';
  return (
    <Badge
      variant={webEnv.app.isProduction ? 'good' : 'muted'}
      data-testid="env-chip"
      className="font-mono tracking-wider uppercase"
    >
      {label}
    </Badge>
  );
}
