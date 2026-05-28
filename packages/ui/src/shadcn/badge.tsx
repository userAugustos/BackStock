import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        signal: 'border-primary/30 bg-primary/12 text-primary',
        good: 'border-[var(--good)]/30 bg-[var(--good)]/12 text-[var(--good)]',
        warning: 'border-[var(--warning)]/30 bg-[var(--warning)]/12 text-[var(--warning)]',
        danger: 'border-[var(--danger)]/30 bg-[var(--danger)]/14 text-[var(--danger)]',
        info: 'border-[var(--info)]/30 bg-[var(--info)]/12 text-[var(--info)]',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return <Comp className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
