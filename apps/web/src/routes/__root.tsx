import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import type { QueryClient } from '@tanstack/react-query';

import { Toaster } from '@repo/ui/shadcn/sonner';
import { TooltipProvider } from '@repo/ui/shadcn/tooltip';
import { TopBar } from '@/modules/core/TopBar';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        <TooltipProvider delayDuration={200}>
          <div className="control-room-canvas flex min-h-screen flex-col">
            <TopBar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
              <Outlet />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
