import { Link } from '@tanstack/react-router';
import { GitCompareArrows, LayoutGrid } from 'lucide-react';

import { cn } from '@repo/ui/utils';
import { EnvChip } from '@/modules/core/EnvChip';
import { StatusDot } from '@/modules/core/StatusDot';

const NAV_ITEMS = [
  { to: '/', label: 'Days', icon: LayoutGrid, testid: 'nav-days' },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows, testid: 'nav-compare' },
] as const;

export function TopBar() {
  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" data-testid="wordmark">
          <span className="bg-primary/15 ring-primary/30 grid size-7 place-items-center rounded-md ring-1">
            <span className="bg-primary size-2.5 rounded-[3px] shadow-[0_0_8px_var(--primary)]" />
          </span>
          <span className="font-display text-base font-extrabold tracking-tight">
            BACK<span className="text-primary">STOCK</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon, testid }) => (
            <Link
              key={to}
              to={to}
              data-testid={testid}
              activeOptions={{ exact: to === '/' }}
              className={cn(
                'text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-[color,background-color] duration-150'
              )}
              activeProps={{ className: 'bg-accent text-foreground' }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <StatusDot />
          <EnvChip />
        </div>
      </div>
    </header>
  );
}
