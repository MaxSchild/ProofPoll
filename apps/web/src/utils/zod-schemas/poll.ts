import { z } from 'zod';

export const MAX_QUESTIONS = 10;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
// Keeps the stored author list well under the database's 20 kB limit.
export const MAX_AUTHORS = 10;

const blank = (value: string) => value.trim().length === 0;

const optionSchema = z.object({
  text: z
    .string()
    .max(200, 'Keep options under 200 characters')
    .refine((value) => !blank(value), 'Enter the option text'),
  // The correct answer of an attention check. Ignored unless the question is
  // marked as the attention check.
  correct: z.boolean(),
});

const questionSchema = z
  .object({
    text: z
      .string()
      .max(500, 'Keep questions under 500 characters')
      .refine((value) => !blank(value), 'Enter the question'),
    options: z
      .array(optionSchema)
      .min(MIN_OPTIONS, `Add at least ${MIN_OPTIONS} options`)
      .max(MAX_OPTIONS, `Use at most ${MAX_OPTIONS} options`),
    attentionCheck: z.boolean(),
  })
  .superRefine((question, ctx) => {
    const seen = new Set<string>();
    question.options.forEach((option, index) => {
      const key = option.text.trim();
      if (key === '') return;
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', index, 'text'],
          message: 'Options must be different from each other',
        });
      }
      seen.add(key);
    });

    if (
      question.attentionCheck &&
      !question.options.some((option) => option.correct)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Pick the correct option for the attention check',
      });
    }
  });

const authorSchema = z
  .object({
    name: z.string().max(200, 'Keep names under 200 characters'),
    affiliation: z.string().max(200, 'Keep affiliations under 200 characters'),
  })
  .superRefine((author, ctx) => {
    if (blank(author.name) && !blank(author.affiliation)) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'Enter the author’s name',
      });
    }
  });

export const pollFormSchema = z
  .object({
    title: z
      .string()
      .max(200, 'Keep the title under 200 characters')
      .refine((value) => !blank(value), 'Enter a title'),
    description: z.string().max(5000, 'Keep the plan under 5000 characters'),
    plannedN: z
      .number('Enter a whole number')
      .int('Enter a whole number')
      .min(1, 'Enter a number of 1 or more')
      .max(100000, 'Enter a number up to 100,000')
      .nullable(),
    questions: z
      .array(questionSchema)
      .min(1, 'Add at least one question')
      .max(MAX_QUESTIONS, `Use at most ${MAX_QUESTIONS} questions`),
    exclusionText: z
      .string()
      .max(5000, 'Keep the rules under 5000 characters'),
    excludeFailedAttentionCheck: z.boolean(),
    authors: z.array(authorSchema).max(MAX_AUTHORS),
  })
  .superRefine((poll, ctx) => {
    const checks = poll.questions.filter((q) => q.attentionCheck).length;
    if (checks > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'Only one question can be the attention check',
      });
    }
  });

export type PollFormValues = z.infer<typeof pollFormSchema>;
export type PollQuestionValues = PollFormValues['questions'][number];

export const pollIdSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{8}$/, 'Unknown poll'),
});

export const updatePollSchema = pollFormSchema.safeExtend(pollIdSchema.shape);
