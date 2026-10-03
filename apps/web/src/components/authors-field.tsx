'use client';

import { Plus, X } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MAX_AUTHORS, type AuthorValues } from '@/utils/zod-schemas/poll';

// Shared by the poll and paper forms: any form with an `authors` list.
export function AuthorsField({
  description = 'Optional. Used later in the summary of where the data came from.',
}: {
  description?: string;
}) {
  const form = useFormContext<{ authors: AuthorValues[] }>();
  const authors = useFieldArray({ control: form.control, name: 'authors' });

  return (
    <section aria-labelledby="authors-heading" className="space-y-4">
      <div>
        <h2 id="authors-heading" className="text-lg font-semibold tracking-tight">
          Authors
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {authors.fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <FormField
            control={form.control}
            name={`authors.${index}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="sr-only">Author {index + 1} name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Name" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 text-destructive hover:text-destructive sm:order-last sm:size-9"
            aria-label={`Remove author ${index + 1}`}
            onClick={() => authors.remove(index)}
          >
            <X aria-hidden="true" />
          </Button>
          <FormField
            control={form.control}
            name={`authors.${index}.affiliation`}
            render={({ field }) => (
              <FormItem className="col-span-2 sm:col-span-1">
                <FormLabel className="sr-only">
                  Author {index + 1} affiliation
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Affiliation" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        disabled={authors.fields.length >= MAX_AUTHORS}
        onClick={() => authors.append({ name: '', affiliation: '' })}
      >
        <Plus aria-hidden="true" />
        Add author
      </Button>
    </section>
  );
}
