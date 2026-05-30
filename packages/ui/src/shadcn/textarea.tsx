import * as React from 'react';

import { cn } from '../lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'border-input bg-background/60 placeholder:text-muted-foreground focus-visible:border-ring/60 focus-visible:ring-ring/60 aria-invalid:border-destructive/70 aria-invalid:ring-destructive/30 flex min-h-24 w-full rounded-lg border px-3 py-2 text-sm shadow-[var(--elevation-1)] transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
