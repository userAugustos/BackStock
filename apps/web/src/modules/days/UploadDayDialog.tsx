import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import type { CreateDayResult } from '@back-stock/api/days';

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
import { Label } from '@repo/ui/shadcn/label';
import { toast } from '@repo/ui/shadcn/sonner';
import { Textarea } from '@repo/ui/shadcn/textarea';
import { ApiResponseError } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';
import { createDayMutationOptions } from '@/modules/days/days.queries';
import { EXAMPLE_DAY_JSON, uploadFormSchema } from '@/modules/days/uploadSchema';
import type { UploadFormInput, UploadFormOutput } from '@/modules/days/uploadSchema';

export function UploadDayDialog() {
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);

  const form = useForm<UploadFormInput, unknown, UploadFormOutput>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { body: '' },
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    ...createDayMutationOptions(),
    onSuccess: (result: CreateDayResult) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.days.all });
      const ignoredCount = result.ignored_report?.length ?? 0;
      toast.success(`Day "${result.name}" created`, {
        description:
          ignoredCount > 0
            ? `${result.sku_count} SKUs · ${result.event_count} events · ${ignoredCount} ignored`
            : `${result.sku_count} SKUs · ${result.event_count} events`,
      });
      form.reset();
      closeRef.current?.click();
    },
    onError: (error: Error) => {
      const message = error instanceof ApiResponseError ? error.message : 'Upload failed';
      toast.error('Could not create day', { description: message });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values.body);
  });

  const fieldError = form.formState.errors.body?.message;

  return (
    <Dialog onOpenChange={(open) => !open && form.reset()}>
      <DialogTrigger asChild>
        <Button data-testid="upload-day-trigger">
          <Upload />
          Upload day
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" data-testid="upload-day-dialog">
        <DialogHeader>
          <DialogTitle>Upload a store day</DialogTitle>
          <DialogDescription>
            Paste a store-day event stream as JSON. Unknown event types are reported, not rejected.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="flex items-center justify-between">
            <Label htmlFor="day-body">Store-day JSON</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="upload-day-example"
              onClick={() =>
                form.setValue('body', EXAMPLE_DAY_JSON, {
                  shouldDirty: true,
                  shouldValidate: false,
                })
              }
            >
              <FileUp />
              Load example
            </Button>
          </div>

          <Textarea
            id="day-body"
            data-testid="upload-day-input"
            spellCheck={false}
            rows={14}
            placeholder='{ "name": "...", "seed_state": { ... }, "events": [ ... ] }'
            aria-invalid={fieldError ? true : undefined}
            className="font-mono text-xs leading-relaxed"
            {...form.register('body')}
          />

          {fieldError ? (
            <p data-testid="upload-day-error" className="text-sm text-[var(--danger)]">
              {fieldError}
            </p>
          ) : null}

          <DialogFooter className="pt-1">
            <DialogClose ref={closeRef} asChild>
              <Button type="button" variant="ghost" data-testid="upload-day-cancel">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending} data-testid="upload-day-submit">
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Create day
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
