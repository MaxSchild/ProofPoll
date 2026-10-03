'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

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
import { Textarea } from '@/components/ui/textarea';
import { createPollAction, updatePollAction } from '@/data/user/polls';
import { emptyPollFormValues } from '@/utils/polls';
import {
  MAX_QUESTIONS,
  pollFormSchema,
  type PollFormValues,
} from '@/utils/zod-schemas/poll';
import { AuthorsField } from './authors-field';
import { QuestionCard } from './question-card';

type PollFormProps =
  | { mode: 'create'; defaultValues?: undefined; pollId?: undefined }
  | { mode: 'edit'; defaultValues: PollFormValues; pollId: string };

function newQuestion(): PollFormValues['questions'][number] {
  return emptyPollFormValues().questions[0];
}

export function PollForm({ mode, defaultValues, pollId }: PollFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    defaultValues: defaultValues ?? emptyPollFormValues(),
    mode: 'onTouched',
  });

  const questions = useFieldArray({ control: form.control, name: 'questions' });
  const watchedQuestions = useWatch({ control: form.control, name: 'questions' });
  const hasAttentionCheck = watchedQuestions.some((q) => q.attentionCheck);

  const onSuccess = ({ data }: { data?: { id: string } }) => {
    if (data) router.push(`/polls/${data.id}`);
  };
  const onError = ({ error }: { error: { serverError?: string } }) => {
    setServerError(
      error.serverError ?? "The poll couldn't be saved. Check the form and try again."
    );
  };
  const create = useAction(createPollAction, { onSuccess, onError });
  const update = useAction(updatePollAction, { onSuccess, onError });
  const isSaving =
    create.isExecuting || update.isExecuting || create.hasSucceeded || update.hasSucceeded;

  function onSubmit(values: PollFormValues) {
    setServerError(null);
    if (mode === 'edit') update.execute({ ...values, id: pollId });
    else create.execute(values);
  }

  function markAttentionCheck(index: number, checked: boolean) {
    form.setValue(`questions.${index}.attentionCheck`, checked, {
      shouldDirty: true,
    });
    if (!checked) {
      form.clearErrors(`questions.${index}.options`);
      return;
    }
    let unmarked = false;
    questions.fields.forEach((_, other) => {
      if (other !== index && form.getValues(`questions.${other}.attentionCheck`)) {
        form.setValue(`questions.${other}.attentionCheck`, false, {
          shouldDirty: true,
        });
        unmarked = true;
      }
    });
    if (unmarked) {
      toast.info(
        `Only one question can be the attention check. Question ${index + 1} is now the one.`
      );
    }
  }

  const questionsError =
    form.formState.errors.questions?.root?.message ??
    form.formState.errors.questions?.message;
  const cancelHref = mode === 'edit' ? `/polls/${pollId}` : '/dashboard';

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="mx-auto w-full max-w-2xl space-y-8"
      >
        <section aria-label="Basics" className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" maxLength={200} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Study plan</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={4} />
                </FormControl>
                <FormDescription>
                  Shown to participants and recorded as part of the plan.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="plannedN"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Planned participants</FormLabel>
                <FormControl>
                  <Input
                    ref={field.ref}
                    name={field.name}
                    onBlur={field.onBlur}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className="w-32 font-mono tabular-nums"
                    value={field.value ?? ''}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === '' ? null : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormDescription>Optional.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <Separator />

        <section aria-labelledby="questions-heading" className="space-y-4">
          <div>
            <h2 id="questions-heading" className="text-lg font-semibold tracking-tight">
              Questions
            </h2>
            <p className="text-sm text-muted-foreground">
              Each question is single choice with 2 to 8 options. You can add up
              to {MAX_QUESTIONS} questions.
            </p>
          </div>

          {questions.fields.map((field, index) => (
            <QuestionCard
              key={field.id}
              index={index}
              count={questions.fields.length}
              onMove={(to) => questions.move(index, to)}
              onRemove={() => questions.remove(index)}
              onAttentionCheckChange={(checked) =>
                markAttentionCheck(index, checked)
              }
            />
          ))}

          {questionsError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {questionsError}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={questions.fields.length >= MAX_QUESTIONS}
            onClick={() => questions.append(newQuestion())}
          >
            <Plus aria-hidden="true" />
            Add question
          </Button>
        </section>

        <Separator />

        <section aria-labelledby="rules-heading" className="space-y-4">
          <h2 id="rules-heading" className="text-lg font-semibold tracking-tight">
            Exclusion rules
          </h2>
          <FormField
            control={form.control}
            name="exclusionText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Exclusion rules</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
                <FormDescription>
                  Optional. Say which answers you will leave out of the analysis,
                  and why.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {hasAttentionCheck ? (
            <FormField
              control={form.control}
              name="excludeFailedAttentionCheck"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Exclude answers that fail the attention check
                  </FormLabel>
                </FormItem>
              )}
            />
          ) : null}
        </section>

        <Separator />

        <AuthorsField />

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button asChild variant="outline" className="h-11 sm:h-9">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSaving} className="h-11 sm:h-9">
            {isSaving ? <Spinner aria-hidden="true" /> : null}
            {mode === 'edit' ? 'Save changes' : 'Save as draft'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
