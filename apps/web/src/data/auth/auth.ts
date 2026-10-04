'use server';
import { actionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import { toSiteURL } from '@/utils/helpers';
import { UserFacingError } from '@/utils/user-facing-error';
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});

/**
 * Signs up a new user with email and password.
 * @param {Object} params - The parameters for sign up.
 * @param {string} params.email - The user's email address.
 * @param {string} params.password - The user's password (minimum 3 characters).
 * @returns {Promise<{signedIn: boolean}>} Whether the user is signed in already (no email confirmation needed).
 * @throws {Error} If there's an error during sign up.
 */
export const signUpAction = actionClient
  .schema(signUpSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: toSiteURL('/auth/callback'),
      },
    });

    // Supabase's auth messages ("User already registered", "email rate
    // limit exceeded") are written for users, so they are shown as they are.
    if (error) {
      throw new UserFacingError(error.message);
    }

    // With email confirmation off (as in production), sign-up returns a
    // session and the user is already signed in.
    return { signedIn: data.session !== null };
  });

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * Signs in a user with email and password.
 * @param {Object} params - The parameters for sign in.
 * @param {string} params.email - The user's email address.
 * @param {string} params.password - The user's password.
 * @throws {Error} If there's an error during sign in.
 */
export const signInWithPasswordAction = actionClient
  .schema(signInSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    const supabase = await createSupabaseClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  });

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * Initiates the password reset process for a user.
 * @param {Object} params - The parameters for password reset.
 * @param {string} params.email - The email address of the user requesting password reset.
 * @throws {Error} If there's an error initiating the password reset.
 */
export const resetPasswordAction = actionClient
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput: { email } }) => {
    const supabase = await createSupabaseClient();
    const redirectToURL = new URL(toSiteURL('/auth/callback'));
    redirectToURL.searchParams.set('next', '/update-password');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectToURL.toString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  });
