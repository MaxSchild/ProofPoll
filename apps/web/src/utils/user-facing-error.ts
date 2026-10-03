/**
 * An error whose message is safe and useful to show to the user. Server
 * actions turn any other error into a generic message.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
