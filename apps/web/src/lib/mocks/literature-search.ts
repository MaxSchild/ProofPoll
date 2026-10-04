import 'server-only';

/*
 * MOCK: the daily literature check (prototype spec §12.2, step 6).
 *
 * Real version: a scheduled job queries Crossref and OpenAlex every day for
 * published works whose reference lists or open-access full text cite an
 * ProofPoll link (/papers/<id> or /p/<poll id>), and for works whose title
 * and authors match a paper still in review.
 *
 * Here: run on demand from the paper page, it always "finds" the paper
 * under its own title, with a DOI under Crossref's test prefix 10.5555.
 */

export interface LiteratureMatch {
  doi: string;
  title: string;
  source: 'crossref' | 'openalex';
  reason: 'cites_link' | 'title_authors';
}

export async function findPublishedVersion(paper: {
  id: string;
  title: string;
}): Promise<LiteratureMatch | null> {
  return {
    doi: `10.5555/proofpoll.${paper.id.toLowerCase()}`,
    title: paper.title,
    source: 'crossref',
    reason: 'title_authors',
  };
}
