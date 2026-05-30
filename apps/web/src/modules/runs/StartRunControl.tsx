import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { RunSummary } from '@back-stock/api/runs';

import { Button } from '@repo/ui/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/shadcn/select';
import { toast } from '@repo/ui/shadcn/sonner';
import { ApiResponseError } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';
import { startRunMutationOptions } from '@/modules/runs/runs.queries';
import { versionsListQueryOptions } from '@/modules/versions/versions.queries';

const startRunFormSchema = z.object({
  version_id: z.string().min(1, 'Select a version.'),
});

type StartRunFormValues = z.infer<typeof startRunFormSchema>;

interface StartRunControlProps {
  dayId: string;
}

export function StartRunControl({ dayId }: StartRunControlProps) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery(versionsListQueryOptions());

  const form = useForm<StartRunFormValues>({
    resolver: zodResolver(startRunFormSchema),
    defaultValues: { version_id: '' },
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    ...startRunMutationOptions(dayId),
    onSuccess: (run: RunSummary) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.days.runs(dayId) });
      toast.success('Run queued', { description: `Status: ${run.status}` });
      form.reset({ version_id: '' });
    },
    onError: (error: Error) => {
      toast.error('Could not start run', {
        description: error instanceof ApiResponseError ? error.message : 'Request failed',
      });
    },
  });

  const hasVersions = (versionsQuery.data?.length ?? 0) > 0;
  const disabled = !hasVersions || versionsQuery.isPending || mutation.isPending;

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values.version_id));

  return (
    <form onSubmit={onSubmit} className="space-y-2" data-testid="start-run-control">
      <div className="flex items-center gap-2">
        <Controller
          control={form.control}
          name="version_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger
                data-testid="start-run-version-select"
                aria-invalid={form.formState.errors.version_id ? true : undefined}
                className="w-56"
              >
                <SelectValue placeholder={hasVersions ? 'Select version' : 'No versions'} />
              </SelectTrigger>
              <SelectContent>
                {versionsQuery.data?.map((version) => (
                  <SelectItem
                    key={version.id}
                    value={version.id}
                    data-testid={`start-run-version-${version.id}`}
                  >
                    {version.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <Button type="submit" disabled={disabled} data-testid="start-run-submit">
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
          Start run
        </Button>
      </div>

      {form.formState.errors.version_id ? (
        <p data-testid="start-run-error" className="text-sm text-[var(--danger)]">
          {form.formState.errors.version_id.message}
        </p>
      ) : null}

      {!hasVersions && !versionsQuery.isPending ? (
        <p data-testid="start-run-hint" className="text-muted-foreground text-xs">
          Create a version first to enable replays.
        </p>
      ) : null}
    </form>
  );
}
