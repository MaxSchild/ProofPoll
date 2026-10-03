'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { AuthorsField } from '@/components/authors-field';
import { PollStatusBadge } from '@/components/poll-status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import type { SelectablePoll } from '@/data/user/paper-queries';
import { createPaperAction, updatePaperAction } from '@/data/user/papers';
import { paperFormSchema, type PaperFormValues } from '@/utils/zod-schemas/paper';

type PaperFormProps = { polls: SelectablePoll[] } & (
  | { mode: 'create'; defaultValues?: undefined; paperId?: undefined }
  | { mode: 'edit'; defaultValues: PaperFormValues; paperId: string }
);

export function PaperForm({ mode, polls, defaultValues, paperId }: PaperFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PaperFormValues>({
    resolver: zodResolver(paperFormSchema),
    defaultValues: defaultValues ?? { title: '', authors: [], pollIds: [] },
    mode: 'onTouched',
  });

  const onSuccess = ({ data }: { data?: { id: string } }) => {
    if (data) router.push(`/my-papers/${data.id}`);
  };
  const onError = ({ error }: { error: { serverError?: string } }) => {
    setServerError(
      error.serverError ?? "The paper couldn't be saved. Check the form and try again."
    );
  };
  const create = useAction(createPaperAction, { onSuccess, onError });
  const update = useAction(updatePaperAction, { onSuccess, onError });
  const isSaving =
    create.isExecuting || update.isExecuting || create.hasSucceeded || update.hasSucceeded;

  function onSubmit(values: PaperFormValues) {
    setServerError(null);
    if (mode === 'edit') update.execute({ ...values, id: paperId });
    else create.execute(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" />
              </FormControl>
              <FormDescription>The title of the manuscript.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <FormField
          control={form.control}
          name="pollIds"
          render={({ field, fieldState }) => (
            <FormItem>
              <fieldset
                className="space-y-4"
                aria-describedby="paper-polls-hint paper-polls-error"
                aria-invalid={fieldState.invalid || undefined}
              >
                <legend className="text-lg font-semibold tracking-tight">Studies</legend>
                <p id="paper-polls-hint" className="text-sm text-muted-foreground">
                  The polls this paper reports on. Each poll can belong to one paper. The
                  paper can go to review once all its polls are closed.
                </p>
                {polls.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      You have no opened or closed polls that aren&apos;t in a paper yet.{' '}
                      <Link href="/dashboard" className="underline underline-offset-4">
                        Go to your polls
                      </Link>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ul className="divide-y rounded-lg border bg-card">
                    {polls.map((poll) => {
                      const checked = field.value.includes(poll.id);
                      const inputId = `poll-${poll.id}`;
                      return (
                        <li key={poll.id} className="flex items-center gap-3 px-4 py-3">
                          <Checkbox
                            id={inputId}
                            checked={checked}
                            onCheckedChange={(next) =>
                              field.onChange(
                                next
                                  ? [...field.value, poll.id]
                                  : field.value.filter((id) => id !== poll.id)
                              )
                            }
                          />
                          <label
                            htmlFor={inputId}
                            className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1"
                          >
                            <span className="min-w-0 break-words font-medium">{poll.title}</span>
                            <PollStatusBadge status={poll.status} />
                            <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
                              {poll.answerCount} {poll.answerCount === 1 ? 'answer' : 'answers'}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
              <FormMessage id="paper-polls-error" />
            </FormItem>
          )}
        />

        <Separator />

        <AuthorsField description="Shown on the public page once the paper is published. Reviewers see “Author 1, Author 2…” instead." />

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Spinner aria-hidden="true" /> : null}
            {mode === 'edit' ? 'Save changes' : 'Create paper'}
          </Button>
          <Button asChild variant="outline">
            <Link href={mode === 'edit' ? `/my-papers/${paperId}` : '/my-papers'}>Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
