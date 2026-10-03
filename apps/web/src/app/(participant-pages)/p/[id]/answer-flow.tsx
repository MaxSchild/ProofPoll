'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { submitResponseAction } from '@/data/anon/polls';
import { Skeleton } from '@/components/ui/skeleton';
import {
  countAnswered,
  isComplete,
  loadReceipt,
  saveReceipt,
  type Answers,
} from '@/utils/answers';
import type { PollQuestion } from '@/utils/polls';
import { Receipt } from './receipt';

export interface AnswerFlowPoll {
  id: string;
  title: string;
  description: string;
  questions: PollQuestion[];
}

const SAVE_FAILED = "Your answer wasn't saved. Check your connection and try again.";

export function AnswerFlow({ poll, lab }: { poll: AnswerFlowPoll; lab: boolean }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ seq: number; createdAt: string } | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  // Outside lab mode the device's saved receipt is only known on the client;
  // until it has been read, a placeholder avoids flashing the form.
  const [checked, setChecked] = useState(lab);
  const [round, setRound] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (lab) return;
    const saved = loadReceipt(poll.id);
    if (saved) {
      setReceipt(saved);
      setAlreadyAnswered(true);
    }
    setChecked(true);
  }, [lab, poll.id]);

  useEffect(() => {
    // After "Next participant", the first option of the first question.
    if (round === 0) return;
    formRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
  }, [round]);

  function nextParticipant() {
    setAnswers({});
    setError(null);
    setReceipt(null);
    setAlreadyAnswered(false);
    setRound((current) => current + 1);
  }

  const total = poll.questions.length;
  const answered = countAnswered(poll.questions, answers);
  const complete = isComplete(poll.questions, answers);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitResponseAction({ pollId: poll.id, answers });
      if (result?.data) {
        const saved = { seq: result.data.seq, createdAt: result.data.createdAt };
        // Lab computers are shared, so they are never locked.
        if (!lab) saveReceipt(poll.id, saved);
        setReceipt(saved);
      } else {
        setError(result?.serverError ?? SAVE_FAILED);
      }
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  // Enter inside a radio group must not submit the form early; Enter on the
  // Submit button still does.
  function guardEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement && event.target.type === 'submit')) {
      event.preventDefault();
    }
  }

  if (!checked) {
    return (
      <div aria-busy="true" className="space-y-4 sm:rounded-xl sm:border sm:bg-card sm:p-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (receipt) {
    return (
      <Receipt
        seq={receipt.seq}
        createdAt={receipt.createdAt}
        alreadyAnswered={alreadyAnswered}
        lab={lab}
        onNextParticipant={nextParticipant}
      />
    );
  }

  return (
    <div className="sm:rounded-xl sm:border sm:bg-card sm:p-8">
      <header className="space-y-2">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{poll.title}</h1>
        {poll.description ? (
          <p className="whitespace-pre-line break-words text-base text-muted-foreground">
            {poll.description}
          </p>
        ) : null}
      </header>
      <form ref={formRef} key={round} onSubmit={submit} onKeyDown={guardEnter} className="mt-6 space-y-6 border-t pt-6">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{answered}</span> of{' '}
          <span className="font-mono tabular-nums">{total}</span>{' '}
          {total === 1 ? 'question' : 'questions'} answered
        </p>
        {poll.questions.map((question, index) => (
          <QuestionField
            key={question.id}
            question={question}
            number={index + 1}
            value={answers[question.id] ?? ''}
            onChange={(value) => {
              setAnswers((current) => ({ ...current, [question.id]: value }));
            }}
          />
        ))}
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {complete ? (
              <span className="hidden sm:block" />
            ) : (
              <p id="submit-hint" className="text-sm text-muted-foreground">
                Answer all questions to submit.
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full text-base sm:w-auto"
              disabled={!complete || submitting}
              aria-describedby={complete ? undefined : 'submit-hint'}
            >
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Submit answers
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Anonymous. No sign-in needed.</p>
        </div>
      </form>
    </div>
  );
}

function QuestionField({
  question,
  number,
  value,
  onChange,
}: {
  question: PollQuestion;
  number: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelId = `${question.id}-label`;
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend id={labelId} className="mb-3 flex gap-2 text-base font-medium">
        <span className="font-mono">{number}.</span>
        <span className="break-words">{question.text}</span>
      </legend>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={onChange}
        className="gap-2"
      >
        {question.options.map((option, index) => {
          const id = `${question.id}-option-${index}`;
          return (
            <Label
              key={id}
              htmlFor={id}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border border-input px-4 py-3 text-base font-normal leading-snug has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary"
            >
              <RadioGroupItem
                id={id}
                value={option}
                className="size-5 shrink-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <span className="min-w-0 break-words">{option}</span>
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
