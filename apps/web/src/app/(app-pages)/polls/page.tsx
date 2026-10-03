import { redirect } from 'next/navigation';

// The breadcrumb links to /polls; the list of polls lives on the dashboard.
export default function PollsPage() {
  redirect('/dashboard');
}
