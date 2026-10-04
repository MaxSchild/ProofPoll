import { getPoll, getPollResponses } from '@/data/user/poll-queries';
import { responsesToCsv } from '@/utils/results';
import { PRODUCT_SLUG } from '@/constants';

// The poll's dataset as CSV, for its owner only (getPoll filters on the owner).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poll = await getPoll(id);
  if (!poll) return new Response('Not found', { status: 404 });

  const responses = await getPollResponses(id);
  return new Response(responsesToCsv(poll.questions, responses), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${PRODUCT_SLUG}-${id}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
