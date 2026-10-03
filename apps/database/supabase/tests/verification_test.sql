BEGIN;

SELECT plan(52);

-- -----------------------------------------------------------------------------
-- Fixtures: two researchers, a closed poll with 4 answers of which 1 fails
-- the attention check (and the rule excludes it), and an open poll.
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');

CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_user IS NULL THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SET LOCAL ROLE anon;
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
  END IF;
END;
$$;

SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT public.save_poll(NULL, '{"title":"Commute","questions":[{"id":"q1","text":"How?","options":["Walk","Bike"]},{"id":"q2","text":"Pick Yes","options":["No","Yes"]}],"exclusion_rules":{"text":"","exclude_failed_attention_check":true}}', '{"question_id":"q2","correct_option":"Yes"}');
CREATE TEMP TABLE ids AS SELECT id, title FROM public.polls;
GRANT SELECT ON ids TO anon, authenticated;
SELECT public.save_poll(NULL, '{"title":"Still open","questions":[{"id":"q1","text":"?","options":["A","B"]}]}', NULL);
SELECT public.save_poll(NULL, '{"title":"Draft poll","questions":[{"id":"q1","text":"?","options":["A","B"]}]}', NULL);
UPDATE public.polls SET status = 'open' WHERE title IN ('Commute', 'Still open');

RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT public.submit_response((SELECT id FROM ids), '{"q1":"Walk","q2":"Yes"}');
SELECT public.submit_response((SELECT id FROM ids), '{"q1":"Walk","q2":"Yes"}');
SELECT public.submit_response((SELECT id FROM ids), '{"q1":"Bike","q2":"Yes"}');
SELECT public.submit_response((SELECT id FROM ids), '{"q1":"Bike","q2":"No"}');

RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
UPDATE public.polls SET status = 'closed' WHERE title = 'Commute';

-- -----------------------------------------------------------------------------
-- Papers group opened polls
-- -----------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT public.save_paper(NULL, '{"title":"P"}', ARRAY(SELECT id FROM public.polls WHERE title = 'Draft poll'))$$,
  '23514',
  'Only opened or closed polls can be added to a paper',
  'draft polls cannot join a paper'
);
SELECT throws_ok(
  $$SELECT public.save_paper(NULL, '{"title":"P"}', '{}')$$,
  '23514',
  'Choose at least one poll',
  'a paper needs a poll'
);

SELECT lives_ok(
  $$SELECT public.save_paper(NULL, '{"title":"Commuting and mood","authors":[{"name":"Ada Author","affiliation":"WHU"}]}', ARRAY(SELECT id FROM public.polls WHERE title IN ('Commute', 'Still open')))$$,
  'the owner creates a paper from an open and a closed poll'
);
CREATE TEMP TABLE paper AS SELECT id FROM public.papers;
GRANT SELECT ON paper TO anon, authenticated;
SELECT is(
  (SELECT count(*)::integer FROM public.polls WHERE paper_id = (SELECT id FROM paper)),
  2,
  'both polls belong to the paper'
);
SELECT is((SELECT status::text FROM public.papers), 'draft', 'a new paper is a draft');

SELECT throws_ok(
  $$UPDATE public.papers SET status = 'in_review'$$,
  '23514',
  'A paper goes to review by confirming a review version',
  'a paper cannot be sent to review directly'
);
SELECT throws_ok(
  $$SELECT public.create_paper_version((SELECT id FROM paper), repeat('a', 64), 'paper.pdf', '{}')$$,
  '23514',
  'Close all polls of this paper before sending it to review',
  'review needs every poll closed'
);

-- The open poll leaves the paper again.
SELECT lives_ok(
  $$SELECT public.save_paper((SELECT id FROM paper), '{"title":"Commuting and mood","authors":[{"name":"Ada Author","affiliation":"WHU"}]}', ARRAY(SELECT id FROM public.polls WHERE title = 'Commute'))$$,
  'the owner removes a poll from a draft paper'
);
SELECT is(
  (SELECT paper_id FROM public.polls WHERE title = 'Still open'),
  NULL,
  'the removed poll no longer has a paper'
);

RESET ROLE;
SELECT pg_temp.act_as('22222222-2222-2222-2222-222222222222');
SELECT is_empty($$SELECT 1 FROM public.papers$$, 'other researchers cannot see the paper');
SELECT throws_ok(
  $$SELECT public.create_paper_version((SELECT id FROM paper), repeat('a', 64), 'paper.pdf', '{}')$$,
  '23514',
  'This paper could not be found',
  'other researchers cannot start a review round'
);
SELECT throws_ok(
  $$SELECT public.save_paper(NULL, '{"title":"Steal"}', ARRAY(SELECT id FROM ids))$$,
  '23514',
  'Some polls could not be added: they belong to another paper or were not found',
  'other researchers cannot add the poll to their own paper'
);

-- -----------------------------------------------------------------------------
-- Review rounds and the validation function
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
  $$SELECT public.create_paper_version((SELECT id FROM paper), repeat('a', 64), 'paper.pdf',
    jsonb_build_object((SELECT id FROM ids), '{"reported_n": 3, "reported_exclusions": 1}'::jsonb))$$,
  'the owner starts a review round'
);
SELECT is(
  (SELECT reported_n FROM public.version_study_numbers),
  3,
  'extracted numbers are proposed'
);
SELECT lives_ok(
  $$SELECT public.create_paper_version((SELECT id FROM paper), repeat('b', 64), 'paper-v1b.pdf',
    jsonb_build_object((SELECT id FROM ids), '{"reported_n": 3}'::jsonb))$$,
  'uploading again replaces the unconfirmed round'
);
SELECT results_eq(
  $$SELECT version, manuscript_sha256 FROM public.paper_versions$$,
  $$VALUES (1, repeat('b', 64))$$,
  'only the latest unconfirmed upload is kept, as version 1'
);
CREATE TEMP TABLE v1 AS SELECT id, review_token FROM public.paper_versions;
GRANT SELECT ON v1 TO anon, authenticated;

RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT is(
  public.get_review_version((SELECT review_token FROM v1)),
  NULL,
  'the review link does not work before the numbers are confirmed'
);

-- A poll added to the paper after the upload makes the round stale.
RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
UPDATE public.polls SET status = 'closed' WHERE title = 'Still open';
SELECT public.save_paper((SELECT id FROM paper), '{"title":"Commuting and mood","authors":[{"name":"Ada Author","affiliation":"WHU"}]}', ARRAY(SELECT id FROM public.polls WHERE title IN ('Commute', 'Still open')));
SELECT throws_ok(
  $$SELECT public.confirm_paper_version((SELECT id FROM v1), '{}')$$,
  '23514',
  'The polls of this paper changed since the upload. Upload the manuscript again.',
  'a round cannot be confirmed after the paper''s polls changed'
);
SELECT public.save_paper((SELECT id FROM paper), '{"title":"Commuting and mood","authors":[{"name":"Ada Author","affiliation":"WHU"}]}', ARRAY(SELECT id FROM public.polls WHERE title = 'Commute'));

RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
  $$SELECT public.confirm_paper_version((SELECT id FROM v1), jsonb_build_object((SELECT id FROM ids), '{"reported_results": {"q9": {"A": 50}}}'::jsonb))$$,
  '23514',
  'Results name a question that is not in poll "Commute"',
  'results must name the poll''s questions'
);
SELECT throws_ok(
  $$SELECT public.confirm_paper_version((SELECT id FROM v1), jsonb_build_object((SELECT id FROM ids), '{"reported_n": 2.5}'::jsonb))$$,
  '23514',
  'N and exclusions must be whole numbers of 0 or more',
  'N must be a whole number'
);
SELECT lives_ok(
  $$SELECT public.confirm_paper_version((SELECT id FROM v1), jsonb_build_object((SELECT id FROM ids),
    '{"reported_n": 3, "reported_exclusions": 1, "reported_results": {"q1": {"Walk": 67, "Bike": 33}}}'::jsonb))$$,
  'the owner confirms the numbers'
);
SELECT results_eq(
  $$SELECT verdict, levels_run FROM public.validation_results$$,
  $$VALUES ('consistent', ARRAY['count', 'results'])$$,
  'recorded 4, rule excludes 1, paper reports 3 and 67/33%: consistent on both levels'
);
SELECT results_eq(
  $$SELECT (details -> 'count' ->> 'recorded')::int, (details -> 'count' ->> 'excluded_by_rule')::int, (details -> 'count' ->> 'gap')::int FROM public.validation_results$$,
  $$VALUES (4, 1, 0)$$,
  'the count check is computed from the stored answers'
);
SELECT is(
  (SELECT details -> 'results' -> 'items' -> 0 ->> 'recorded' FROM public.validation_results),
  '66.7',
  'results are computed after the registered exclusions'
);
SELECT is((SELECT status::text FROM public.papers), 'in_review', 'confirming sends the paper to review');

-- Researchers can read verdicts but never write them.
SELECT throws_ok(
  $$INSERT INTO public.validation_results (version_id, poll_id, verdict, levels_run, details) VALUES ((SELECT id FROM v1), (SELECT id FROM ids), 'consistent', '{}', '{}')$$,
  '42501',
  NULL,
  'researchers cannot insert verdicts'
);
UPDATE public.validation_results SET verdict = 'consistent';
UPDATE public.version_study_numbers SET reported_n = 4;
SELECT is((SELECT reported_n FROM public.version_study_numbers), 3, 'researchers cannot change confirmed numbers');
SELECT throws_ok(
  $$SELECT public.discard_paper_version((SELECT id FROM v1))$$,
  '23514',
  'A confirmed review round cannot be removed',
  'a confirmed round cannot be discarded'
);
SELECT throws_ok(
  $$UPDATE public.papers SET title = 'Renamed'$$,
  '23514',
  'Title and authors can only change before the first review round',
  'the title is fixed once in review'
);
SELECT throws_ok(
  $$UPDATE public.polls SET paper_id = NULL WHERE title = 'Commute'$$,
  '23514',
  'Polls cannot be removed from a paper that has gone to review',
  'polls cannot leave a paper in review'
);

RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.validation_results SET verdict = 'inconsistent'$$,
  '23514',
  'A confirmed review round cannot be changed',
  'nobody can change a confirmed verdict, not even the service'
);

-- Round 2 reports fewer answers than the record holds.
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
  $$SELECT public.confirm_paper_version(
      public.create_paper_version((SELECT id FROM paper), repeat('c', 64), 'paper-v2.pdf', '{}'),
      jsonb_build_object((SELECT id FROM ids), '{"reported_n": 2, "reported_results": {"q1": {"Walk": 50}}}'::jsonb))$$,
  'the owner confirms a second round'
);
SELECT results_eq(
  $$SELECT r.verdict, (r.details -> 'count' ->> 'gap')::int, r.details -> 'results' ->> 'verdict'
    FROM public.validation_results r JOIN public.paper_versions v ON v.id = r.version_id WHERE v.version = 2$$,
  $$VALUES ('inconsistent', 1, 'inconsistent')$$,
  'paper reports 2 where 3 remain after exclusions: 1 unaccounted for, results off'
);
SELECT lives_ok(
  $$SELECT public.confirm_paper_version(
      public.create_paper_version((SELECT id FROM paper), repeat('d', 64), 'paper-v3.pdf', '{}'), '{}')$$,
  'a round without numbers can be confirmed'
);
SELECT is(
  (SELECT r.verdict FROM public.validation_results r JOIN public.paper_versions v ON v.id = r.version_id WHERE v.version = 3),
  'not_checkable',
  'without numbers the study is not checkable'
);

-- -----------------------------------------------------------------------------
-- Reviewers: anonymous, aggregates only
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT is(
  (public.get_review_version((SELECT review_token FROM v1)) ->> 'author_count')::int,
  1,
  'reviewers see how many authors there are'
);
SELECT ok(
  NOT (public.get_review_version((SELECT review_token FROM v1))::text LIKE '%Ada Author%'),
  'reviewers do not see author names'
);
SELECT is(
  public.get_review_version((SELECT review_token FROM v1)) -> 'studies' -> 0 -> 'validation' ->> 'verdict',
  'consistent',
  'reviewers see the verdict of their round'
);
SELECT is(
  public.get_review_version((SELECT review_token FROM v1)) -> 'studies' -> 0 -> 'results',
  'null'::jsonb,
  'reviewers do not get per-question results'
);
SELECT is(public.get_published_paper((SELECT id FROM paper)), NULL, 'the public page is empty before publication');
SELECT is_empty(
  $$SELECT * FROM public.search_published_papers('{}', '{}', ARRAY['commuting', 'mood'])$$,
  'papers in review are not searchable'
);
SELECT is_empty($$SELECT 1 FROM public.paper_versions$$, 'anonymous visitors cannot list review rounds');

-- -----------------------------------------------------------------------------
-- DOI detection and publication
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT public.record_doi_match((SELECT id FROM paper), '10.5555/AC.1', 'Commuting and mood', 'crossref', 'title_authors');
UPDATE public.papers SET auto_matched = true;
SELECT is((SELECT auto_matched FROM public.papers), false, 'auto_matched cannot be set by the researcher');
SELECT is(public.publish_expired_doi_matches(), 0, 'nothing is published before the 14 days are over');
SELECT public.expire_doi_match_now((SELECT id FROM public.doi_matches));
SELECT results_eq(
  $$SELECT status::text, doi, auto_matched FROM public.papers$$,
  $$VALUES ('published', '10.5555/ac.1', true)$$,
  'an unanswered match publishes the paper, marked as matched automatically'
);
SELECT is((SELECT status FROM public.doi_matches), 'auto_published', 'the match is closed');

RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT is(
  public.get_published_paper((SELECT id FROM paper)) -> 'authors' -> 0 ->> 'name',
  'Ada Author',
  'the public page shows the real authors'
);
SELECT is(
  (public.get_published_paper((SELECT id FROM paper)) ->> 'version')::int,
  3,
  'the public page shows the latest confirmed round'
);
SELECT is(
  public.get_published_paper((SELECT id FROM paper)) -> 'studies' -> 0 -> 'results',
  'null'::jsonb,
  'results stay private without the opt-in'
);
SELECT results_eq(
  $$SELECT id FROM public.search_published_papers('{10.5555/AC.1}', '{}', '{}')
    UNION ALL SELECT id FROM public.search_published_papers('{}', ARRAY[(SELECT id FROM ids)], '{}')
    UNION ALL SELECT id FROM public.search_published_papers('{}', '{}', ARRAY['commuting', 'mood', 'journal'])$$,
  $$VALUES ((SELECT id FROM paper)), ((SELECT id FROM paper)), ((SELECT id FROM paper))$$,
  'published papers are found by DOI, by a poll link and by title words'
);

RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
UPDATE public.papers SET results_public = true;
RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT is(
  public.get_published_paper((SELECT id FROM paper)) -> 'studies' -> 0 -> 'results' -> 'q1',
  '{"Walk": 2, "Bike": 2}'::jsonb,
  'with the opt-in, the public page shows option counts'
);

-- Deleting the researcher's account removes papers, rounds and verdicts.
RESET ROLE;
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is_empty(
  $$SELECT 1 FROM public.papers UNION ALL SELECT 1 FROM public.validation_results$$,
  'deleting the owner account removes their papers and verdicts'
);

SELECT * FROM finish();
ROLLBACK;
