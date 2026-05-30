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
    <header className="border-border/60 bg-background/85 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          to="/"
          className="focus-visible:ring-ring -ml-1.5 inline-flex h-10 items-center gap-2.5 rounded-lg px-1.5 transition-transform duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
          data-testid="wordmark"
        >
          <span className="bg-primary/15 ring-primary/30 grid size-7 place-items-center rounded-md ring-1">
            <span className="bg-primary size-2.5 rounded-[3px] shadow-[0_0_10px_var(--primary)]" />
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
                'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-[color,background-color,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]'
              )}
              activeProps={{
                className: 'bg-accent text-foreground shadow-[inset_0_-2px_0_0_var(--primary)]',
              }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <StatusDot />
          <EnvChip />
        </div>
      </div>
    </header>
  );
}
