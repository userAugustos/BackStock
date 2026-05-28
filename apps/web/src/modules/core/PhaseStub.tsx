import { Link } from '@tanstack/react-router';
import { ArrowLeft, Construction } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@repo/ui/shadcn/button';
import { Card, CardContent } from '@repo/ui/shadcn/card';

interface PhaseStubProps {
  phase: string;
  title: string;
  description: string;
  testid: string;
  children?: ReactNode;
}

export function PhaseStub({ phase, title, description, testid, children }: PhaseStubProps) {
  return (
    <Card data-testid={testid} className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="bg-primary/12 text-primary ring-primary/30 grid size-12 place-items-center rounded-2xl ring-1">
          <Construction className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="text-primary font-mono text-xs tracking-widest uppercase">{phase}</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children}
        <Button asChild variant="outline" size="sm">
          <Link to="/" data-testid={`${testid}-back`}>
            <ArrowLeft />
            Back to days
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
