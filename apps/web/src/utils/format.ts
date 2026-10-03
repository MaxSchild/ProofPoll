// Dates are formatted in UTC so the server render and the browser agree.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "3 Oct 2026, 16:20 UTC" */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${dateFormat.format(date)}, ${timeFormat.format(date)} UTC`;
}
