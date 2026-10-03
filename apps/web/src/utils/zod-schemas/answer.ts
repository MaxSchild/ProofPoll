import { z } from 'zod';

import { MAX_QUESTIONS } from '@/utils/zod-schemas/poll';

/** Input of the participant's submit action: one chosen option per question id. */
export const submitResponseSchema = z.object({
  pollId: z.string().regex(/^[A-Za-z0-9]{8}$/, 'Unknown poll'),
  answers: z
    .record(z.string().max(20), z.string().max(200))
    .refine(
      (answers) => Object.keys(answers).length <= MAX_QUESTIONS,
      `Use at most ${MAX_QUESTIONS} answers`
    ),
  // One per filled-in form, so a retried submit is not stored twice.
  clientId: z.uuid(),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
