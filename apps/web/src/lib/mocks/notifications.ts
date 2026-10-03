import 'server-only';

/*
 * MOCK: notifications (prototype spec §12.2, step 6).
 *
 * Real version: an email to the researcher asking them to confirm a DOI
 * match within 14 days.
 *
 * Here: logged on the server. The researcher sees the match on the paper
 * page.
 */
export async function notifyResearcherOfMatch(match: {
  paperId: string;
  doi: string;
  confirmBy: string;
}): Promise<void> {
  console.info(
    `[mock notification] Paper ${match.paperId} may be published as ${match.doi}; reply by ${match.confirmBy}.`
  );
}
