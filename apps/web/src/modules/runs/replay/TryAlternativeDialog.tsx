import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { GitBranch, Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';

import { BranchRunBodySchema } from '@back-stock/api/runs';
import type { BranchRunBody, RunDecision } from '@back-stock/api/runs';

import { Button } from '@repo/ui/shadcn/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/shadcn/dialog';
import { Input } from '@repo/ui/shadcn/input';
import { Label } from '@repo/ui/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/shadcn/select';
import { toast } from '@repo/ui/shadcn/sonner';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/shadcn/tabs';
import { ApiResponseError } from '@/api';
import { branchRunMutationOptions } from '@/modules/runs/runs.queries';
import { versionsListQueryOptions } from '@/modules/versions/versions.queries';

type AlternativeMode = BranchRunBody['change']['type'];

interface TryAlternativeDialogProps {
  runId: string;
  decision: RunDecision;
  trigger: React.ReactNode;
}

function overrideDefaults(decision: RunDecision): BranchRunBody {
  return {
    at_event_seq: decision.event_seq,
    change: { type: 'decision_override', decision: decision.parsed },
  };
}

export function TryAlternativeDialog({ runId, decision, trigger }: TryAlternativeDialogProps) {
  const navigate = useNavigate();
  const versionsQuery = useQuery(versionsListQueryOptions());

  const form = useForm<BranchRunBody>({
    resolver: zodResolver(BranchRunBodySchema),
    defaultValues: overrideDefaults(decision),
  });

  const mode = form.watch('change.type');

  const mutation = useMutation({
    ...branchRunMutationOptions(runId),
    onSuccess: (run) => {
      toast.success('Branch run queued', { description: `Replaying as ${run.id.slice(0, 8)}` });
      void navigate({ to: '/runs/$runId', params: { runId: run.id } });
    },
    onError: (error: Error) => {
      toast.error('Could not branch run', {
        description: error instanceof ApiResponseError ? error.message : 'Request failed',
      });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (next) form.reset(overrideDefaults(decision));
  };

  const switchMode = (next: AlternativeMode) => {
    if (next === 'decision_override') {
      form.reset(overrideDefaults(decision));
    } else {
      form.reset({
        at_event_seq: decision.event_seq,
        change: { type: 'version', version_id: '' },
      });
    }
  };

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  const isInventory = decision.parsed.agent === 'inventory';

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent data-testid="try-alternative-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="text-primary size-5" />
            Try alternative
          </DialogTitle>
          <DialogDescription>
            Fork this run at event #{decision.event_seq} and replay it under a different choice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Tabs value={mode} onValueChange={(value) => switchMode(value as AlternativeMode)}>
            <TabsList className="w-full">
              <TabsTrigger
                value="decision_override"
                className="flex-1"
                data-testid="alt-mode-override"
              >
                Override decision
              </TabsTrigger>
              <TabsTrigger value="version" className="flex-1" data-testid="alt-mode-version">
                Re-run version
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'decision_override' ? (
            <div className="space-y-3">
              <div className="text-muted-foreground font-mono text-xs">
                {decision.parsed.sku_id} · {decision.agent} agent
              </div>
              {isInventory ? (
                <div className="space-y-1.5">
                  <Label htmlFor="alt-order-cases">Order cases</Label>
                  <Controller
                    control={form.control}
                    name="change.decision.order_cases"
                    render={({ field }) => (
                      <Input
                        id="alt-order-cases"
                        data-testid="alt-order-cases"
                        type="number"
                        min={0}
                        step={1}
                        value={Number.isNaN(field.value) ? '' : (field.value as number)}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        onBlur={field.onBlur}
                        aria-invalid={hasOverrideError(form, 'order_cases')}
                      />
                    )}
                  />
                  <FieldError
                    message={overrideError(form, 'order_cases')}
                    testid="alt-cases-error"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="alt-new-price">New price</Label>
                  <Controller
                    control={form.control}
                    name="change.decision.new_price"
                    render={({ field }) => (
                      <Input
                        id="alt-new-price"
                        data-testid="alt-new-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={Number.isNaN(field.value) ? '' : (field.value as number)}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        onBlur={field.onBlur}
                        aria-invalid={hasOverrideError(form, 'new_price')}
                      />
                    )}
                  />
                  <FieldError message={overrideError(form, 'new_price')} testid="alt-price-error" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="alt-version">Version</Label>
              <Controller
                control={form.control}
                name="change.version_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={versionsQuery.isPending}
                  >
                    <SelectTrigger
                      id="alt-version"
                      data-testid="alt-version-select"
                      aria-invalid={hasVersionError(form)}
                    >
                      <SelectValue placeholder="Select a version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versionsQuery.data?.map((version) => (
                        <SelectItem
                          key={version.id}
                          value={version.id}
                          data-testid={`alt-version-${version.id}`}
                        >
                          {version.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={versionErrorMessage(form)} testid="alt-version-error" />
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" data-testid="alt-cancel">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending} data-testid="alt-submit">
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <GitBranch />}
              Branch &amp; replay
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type BranchForm = ReturnType<typeof useForm<BranchRunBody>>;

function hasOverrideError(form: BranchForm, key: 'order_cases' | 'new_price'): boolean {
  return Boolean(overrideError(form, key));
}

function overrideError(form: BranchForm, key: 'order_cases' | 'new_price'): string | undefined {
  const change = form.formState.errors.change;
  if (!change || !('decision' in change)) return undefined;
  const decisionErrors = change.decision as Record<string, { message?: string }> | undefined;
  return decisionErrors?.[key]?.message;
}

function hasVersionError(form: BranchForm): boolean {
  return Boolean(versionErrorMessage(form));
}

function versionErrorMessage(form: BranchForm): string | undefined {
  const change = form.formState.errors.change;
  if (!change || !('version_id' in change)) return undefined;
  return (change.version_id as { message?: string } | undefined)?.message;
}

function FieldError({ message, testid }: { message?: string; testid: string }) {
  if (!message) return null;
  return (
    <p data-testid={testid} className="text-sm text-[var(--danger)]">
      {message}
    </p>
  );
}
