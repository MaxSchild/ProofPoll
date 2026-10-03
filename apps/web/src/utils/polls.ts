import type { PollFormValues } from '@/utils/zod-schemas/poll';

export type PollStatus = 'draft' | 'open' | 'closed';

export type PollQuestion = {
  id: string;
  text: string;
  options: string[];
};

export interface PollAttentionCheck {
  question_id: string;
  correct_option: string;
}

export interface PollExclusionRules {
  text?: string;
  exclude_failed_attention_check?: boolean;
}

export type PollAuthor = {
  name: string;
  affiliation: string;
};

/** What gets stored for a poll, derived from the form values. */
export interface PollPlan {
  title: string;
  description: string;
  planned_n: number | null;
  questions: PollQuestion[];
  attentionCheck: PollAttentionCheck | null;
  exclusion_rules: { text: string; exclude_failed_attention_check: boolean };
  authors: PollAuthor[];
}

/**
 * Turns the form values into the stored plan. Questions get the ids q1..qN by
 * position, so CSV columns are readable and stable, and the attention check is
 * mapped to the id of its question. Text is trimmed.
 */
export function buildPollPlan(values: PollFormValues): PollPlan {
  const questions: PollQuestion[] = values.questions.map((question, index) => ({
    id: `q${index + 1}`,
    text: question.text.trim(),
    options: question.options.map((option) => option.text.trim()),
  }));

  let attentionCheck: PollAttentionCheck | null = null;
  values.questions.forEach((question, index) => {
    if (attentionCheck || !question.attentionCheck) return;
    const correct = question.options.find((option) => option.correct);
    if (correct) {
      attentionCheck = {
        question_id: `q${index + 1}`,
        correct_option: correct.text.trim(),
      };
    }
  });

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    planned_n: values.plannedN,
    questions,
    attentionCheck,
    exclusion_rules: {
      text: values.exclusionText.trim(),
      exclude_failed_attention_check:
        attentionCheck !== null && values.excludeFailedAttentionCheck,
    },
    authors: values.authors
      .map((author) => ({
        name: author.name.trim(),
        affiliation: author.affiliation.trim(),
      }))
      .filter((author) => author.name !== ''),
  };
}

interface StoredPoll {
  title: string;
  description: string;
  planned_n: number | null;
  questions: PollQuestion[];
  exclusion_rules: PollExclusionRules;
  authors: PollAuthor[];
  attentionCheck: PollAttentionCheck | null;
}

/** The inverse of buildPollPlan, used to fill the edit form. */
export function pollToFormValues(poll: StoredPoll): PollFormValues {
  return {
    title: poll.title,
    description: poll.description,
    plannedN: poll.planned_n,
    questions: poll.questions.map((question) => {
      const isCheck = poll.attentionCheck?.question_id === question.id;
      return {
        text: question.text,
        attentionCheck: isCheck,
        options: question.options.map((text) => ({
          text,
          correct: isCheck && poll.attentionCheck?.correct_option === text,
        })),
      };
    }),
    exclusionText: poll.exclusion_rules.text ?? '',
    excludeFailedAttentionCheck:
      poll.attentionCheck !== null &&
      poll.exclusion_rules.exclude_failed_attention_check === true,
    authors: poll.authors.map((author) => ({
      name: author.name,
      affiliation: author.affiliation,
    })),
  };
}

export function emptyPollFormValues(): PollFormValues {
  return {
    title: '',
    description: '',
    plannedN: null,
    questions: [
      {
        text: '',
        attentionCheck: false,
        options: [
          { text: '', correct: false },
          { text: '', correct: false },
        ],
      },
    ],
    exclusionText: '',
    excludeFailedAttentionCheck: false,
    authors: [],
  };
}
