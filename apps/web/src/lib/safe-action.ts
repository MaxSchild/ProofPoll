import { getLoggedInUserId } from '@/data/user/user';
import { UserFacingError } from '@/utils/user-facing-error';
import {
  createSafeActionClient,
  DEFAULT_SERVER_ERROR_MESSAGE,
} from 'next-safe-action';
import 'server-only';

export const actionClient = createSafeActionClient({
  handleServerError(error) {
    if (error instanceof UserFacingError) return error.message;
    console.error('Server action failed:', error);
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
}).use(async ({ next }) => next());

export const authActionClient = actionClient.use(async ({ next }) => {
  const userId = await getLoggedInUserId();
  return await next({
    ctx: {
      userId,
    },
  });
});
