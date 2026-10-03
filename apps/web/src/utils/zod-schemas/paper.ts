import { z } from 'zod';

import { authorSchema, MAX_AUTHORS } from './poll';

const blank = (value: string) => value.trim().length === 0;
const pollId = z.string().regex(/^[A-Za-z0-9]{8}$/, 'Unknown poll');

export const paperIdSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9]{8}$/, 'Unknown paper'),
});

export const paperFormSchema = z.object({
  title: z
    .string()
    .max(300, 'Keep the title under 300 characters')
    .refine((value) => !blank(value), 'Enter the paper’s title'),
  authors: z.array(authorSchema).max(MAX_AUTHORS),
  pollIds: z.array(pollId).min(1, 'Choose at least one poll').max(20),
});

export type PaperFormValues = z.infer<typeof paperFormSchema>;

export const updatePaperSchema = paperFormSchema.safeExtend(paperIdSchema.shape);

// The manuscript is fingerprinted in the browser; see startReviewRoundAction.
export const startReviewRoundSchema = z.object({
  paperId: paperIdSchema.shape.id,
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'The file fingerprint is invalid'),
  fileName: z.string().min(1).max(255),
});

const count = z
  .number('Enter a whole number')
  .int('Enter a whole number')
  .min(0, 'Enter 0 or more')
  .max(1_000_000, 'Enter a smaller number')
  .nullable();

const percent = z
  .number('Enter a percentage')
  .min(0, 'Enter 0 to 100')
  .max(100, 'Enter 0 to 100');

export const studyNumbersSchema = z.object({
  reportedN: count,
  reportedExclusions: count,
  // question id → option → percent; options left empty are not reported.
  reportedResults: z.record(z.string(), z.record(z.string(), percent.nullable())),
});

export type StudyNumbersValues = z.infer<typeof studyNumbersSchema>;

export const confirmNumbersSchema = z.object({
  versionId: z.uuid(),
  studies: z.record(pollId, studyNumbersSchema),
});

export type ConfirmNumbersValues = z.infer<typeof confirmNumbersSchema>;

export const versionIdSchema = z.object({ versionId: z.uuid() });

export const publishPaperSchema = z.object({
  paperId: paperIdSchema.shape.id,
  doi: z
    .string()
    .trim()
    .regex(/^10\.\d{4,9}\/\S{1,200}$/, 'Enter a DOI like 10.1287/mnsc.2026.01234'),
});

export const resultsPublicSchema = z.object({
  paperId: paperIdSchema.shape.id,
  resultsPublic: z.boolean(),
});

export const doiMatchSchema = z.object({ matchId: z.uuid() });

export const respondToMatchSchema = doiMatchSchema.extend({ confirm: z.boolean() });
