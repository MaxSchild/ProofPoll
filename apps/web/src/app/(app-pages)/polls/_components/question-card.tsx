'use client';

import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldError,
} from 'react-hook-form';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  type PollFormValues,
} from '@/utils/zod-schemas/poll';

const iconButton = 'size-10 sm:size-9';

interface QuestionCardProps {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  onAttentionCheckChange: (checked: boolean) => void;
}

export function QuestionCard({
  index,
  count,
  onMove,
  onRemove,
  onAttentionCheckChange,
}: QuestionCardProps) {
  const form = useFormContext<PollFormValues>();
  const options = useFieldArray({
    control: form.control,
    name: `questions.${index}.options`,
  });
  const question = useWatch({ control: form.control, name: `questions.${index}` });
  const n = index + 1;

  const optionsError = form.formState.errors.questions?.[index]?.options as
    | (FieldError & { root?: FieldError })
    | undefined;
  const optionsMessage = optionsError?.root?.message ?? optionsError?.message;

  const correctIndex = question?.options.findIndex((option) => option.correct) ?? -1;
  const isEmpty =
    !question?.text.trim() && question?.options.every((o) => !o.text.trim());

  function setCorrect(value: string) {
    options.fields.forEach((_, optionIndex) => {
      form.setValue(
        `questions.${index}.options.${optionIndex}.correct`,
        String(optionIndex) === value,
        { shouldDirty: true }
      );
    });
    form.clearErrors(`questions.${index}.options`);
  }

  const optionRows = options.fields.map((field, optionIndex) => (
    <div key={field.id} className="flex items-start gap-2">
      {question?.attentionCheck ? (
        <RadioGroupItem
          value={String(optionIndex)}
          aria-label={`Option ${optionIndex + 1} is the correct answer`}
          className="mt-2.5 size-5 shrink-0"
        />
      ) : null}
      <FormField
        control={form.control}
        name={`questions.${index}.options.${optionIndex}.text`}
        render={({ field }) => (
          <FormItem className="min-w-0 flex-1 space-y-1">
            <FormLabel className="sr-only">
              Option {optionIndex + 1} of question {n}
            </FormLabel>
            <FormControl>
              <Input {...field} placeholder={`Option ${optionIndex + 1}`} autoComplete="off" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex shrink-0 gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          aria-label={`Move option ${optionIndex + 1} of question ${n} up`}
          disabled={optionIndex === 0}
          onClick={() => options.move(optionIndex, optionIndex - 1)}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          aria-label={`Move option ${optionIndex + 1} of question ${n} down`}
          disabled={optionIndex === options.fields.length - 1}
          onClick={() => options.move(optionIndex, optionIndex + 1)}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          aria-label={`Remove option ${optionIndex + 1} of question ${n}`}
          disabled={options.fields.length <= MIN_OPTIONS}
          onClick={() => options.remove(optionIndex)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  ));

  const removeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(iconButton, 'text-destructive hover:text-destructive')}
      aria-label={`Remove question ${n}`}
      disabled={count <= 1}
      onClick={isEmpty ? onRemove : undefined}
    >
      <Trash2 aria-hidden="true" />
    </Button>
  );

  return (
    <Card
      role="group"
      aria-labelledby={`question-${index}-title`}
      className={cn(
        'gap-4 py-4 shadow-none',
        question?.attentionCheck && 'border-l-4 border-l-warning'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CardTitle id={`question-${index}-title`} className="text-base">
            Question {n}
          </CardTitle>
          {question?.attentionCheck ? (
            <Badge className="border-transparent bg-warning-soft text-warning">
              Attention check
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={iconButton}
            aria-label={`Move question ${n} up`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ChevronUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={iconButton}
            aria-label={`Move question ${n} down`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <ChevronDown aria-hidden="true" />
          </Button>
          {isEmpty || count <= 1 ? (
            removeButton
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>{removeButton}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove question {n}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its text and options will be removed from this draft.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep question</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>
                    Remove question
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        <FormField
          control={form.control}
          name={`questions.${index}.text`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Question {n} text</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Question text" autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {question?.attentionCheck ? (
          <p id={`question-${index}-correct-hint`} className="text-sm text-muted-foreground">
            Select the correct option. Answers that pick another option fail the
            attention check.
          </p>
        ) : null}

        {question?.attentionCheck ? (
          <RadioGroup
            value={correctIndex >= 0 ? String(correctIndex) : ''}
            onValueChange={setCorrect}
            aria-labelledby={`question-${index}-correct-hint`}
            className="gap-2"
          >
            {optionRows}
          </RadioGroup>
        ) : (
          <div className="space-y-2">{optionRows}</div>
        )}

        {optionsMessage ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {optionsMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={options.fields.length >= MAX_OPTIONS}
            onClick={() => options.append({ text: '', correct: false })}
          >
            <Plus aria-hidden="true" />
            Add option
          </Button>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`question-${index}-check`}
              checked={question?.attentionCheck ?? false}
              onCheckedChange={(checked) => onAttentionCheckChange(checked === true)}
            />
            <Label htmlFor={`question-${index}-check`} className="font-normal">
              Use as attention check
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
