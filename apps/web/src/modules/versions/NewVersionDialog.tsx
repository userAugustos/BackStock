import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import { CreateVersionBodySchema } from '@back-stock/api/versions';
import type { CreateVersionBody, Version } from '@back-stock/api/versions';

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
import { toast } from '@repo/ui/shadcn/sonner';
import { ApiResponseError } from '@/api';
import { queryKeys } from '@/modules/core/lib/queryKeys';
import { createVersionMutationOptions } from '@/modules/versions/versions.queries';

const DEFAULT_VALUES: CreateVersionBody = {
  label: '',
  inventory_prompt_version: 'inventory-v1',
  pricing_prompt_version: 'pricing-v1',
  model_id: 'stub',
};

type VersionTextField =
  | 'label'
  | 'inventory_prompt_version'
  | 'pricing_prompt_version'
  | 'model_id';

const FIELDS: { name: VersionTextField; label: string; placeholder: string }[] = [
  { name: 'label', label: 'Label', placeholder: 'e.g. baseline-conservative' },
  { name: 'inventory_prompt_version', label: 'Inventory prompt', placeholder: 'inventory-v1' },
  { name: 'pricing_prompt_version', label: 'Pricing prompt', placeholder: 'pricing-v1' },
  { name: 'model_id', label: 'Model', placeholder: 'stub' },
];

export function NewVersionDialog() {
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);

  const form = useForm<CreateVersionBody>({
    resolver: zodResolver(CreateVersionBodySchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    ...createVersionMutationOptions(),
    onSuccess: (version: Version) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.versions.all });
      toast.success(`Version "${version.label}" created`);
      form.reset(DEFAULT_VALUES);
      closeRef.current?.click();
    },
    onError: (error: Error) => {
      if (error instanceof ApiResponseError && error.status === 409) {
        form.setError('label', { message: 'A version with this label already exists.' });
        toast.error('Duplicate label', { description: error.message });
        return;
      }
      toast.error('Could not create version', {
        description: error instanceof ApiResponseError ? error.message : 'Request failed',
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog onOpenChange={(open) => !open && form.reset(DEFAULT_VALUES)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="new-version-trigger">
          <Plus />
          New version
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="new-version-dialog">
        <DialogHeader>
          <DialogTitle>New agent version</DialogTitle>
          <DialogDescription>
            A version pins the prompt revisions and model used when replaying a day.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {FIELDS.map((field) => {
            const error = form.formState.errors[field.name]?.message;
            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`version-${field.name}`}>{field.label}</Label>
                <Input
                  id={`version-${field.name}`}
                  data-testid={`version-${field.name}`}
                  placeholder={field.placeholder}
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  className="font-mono"
                  {...form.register(field.name)}
                />
                {error ? (
                  <p
                    data-testid={`version-${field.name}-error`}
                    className="text-sm text-[var(--danger)]"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}

          <DialogFooter className="pt-1">
            <DialogClose ref={closeRef} asChild>
              <Button type="button" variant="ghost" data-testid="new-version-cancel">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending} data-testid="new-version-submit">
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
