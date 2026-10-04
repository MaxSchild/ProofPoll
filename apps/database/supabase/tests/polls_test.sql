BEGIN;

SELECT plan(64);

-- -----------------------------------------------------------------------------
-- Fixtures: two researchers. Requests run as the roles PostgREST uses, with
-- the JWT claims that auth.uid() reads.
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

-- -----------------------------------------------------------------------------
-- Creating polls
-- -----------------------------------------------------------------------------
SELECT pg_temp.act_as(NULL);
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x', '[{"id":"q1","text":"Q","options":["A","B"]}]')$$,
  '42501',
  NULL,
  'anonymous visitors cannot create polls'
);

RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
INSERT INTO public.polls (id, title, questions, status, opened_at)
VALUES (
  'poll0001',
  'Commute',
  '[{"id":"q1","text":"How did you get here?","options":["Walk","Bike"]},
    {"id":"q2","text":"Pick Purple","options":["Red","Purple"]}]',
  'open',
  now() - interval '1 day'
);

SELECT is(
  (SELECT status::text FROM public.polls WHERE id = 'poll0001'),
  'draft',
  'a new poll always starts as a draft, whatever status is sent'
);
SELECT is(
  (SELECT opened_at FROM public.polls WHERE id = 'poll0001'),
  NULL,
  'opened_at cannot be set on insert'
);
SELECT is(
  (SELECT owner_id FROM public.polls WHERE id = 'poll0001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the owner defaults to the signed-in user'
);

INSERT INTO public.polls (title, questions)
VALUES ('Generated id', '[{"id":"q1","text":"Q","options":["A","B"]}]');
SELECT matches(
  (SELECT id FROM public.polls WHERE title = 'Generated id'),
  '^[A-Za-z0-9]{8}$',
  'generated poll IDs are 8 letters and digits'
);

-- -----------------------------------------------------------------------------
-- Question validation
-- -----------------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x', '[{"id":"q1","text":"Q","options":"A"}]')$$,
  '23514',
  NULL,
  'options must be a list'
);
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x', '[{"id":"q1","text":"Q","options":["A"]}]')$$,
  '23514',
  NULL,
  'a question needs at least two options'
);
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x', '[{"id":"q1","text":"Q","options":["A",2]}]')$$,
  '23514',
  NULL,
  'options must be text'
);
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x', '[{"id":"q1","text":"Q","options":["A","A"]}]')$$,
  '23514',
  'Options of a question must be unique',
  'options of a question must be unique'
);
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x',
    '[{"id":"q1","text":"Q","options":["A","B"]},{"id":"q1","text":"R","options":["A","B"]}]')$$,
  '23514',
  'Question ids must be unique',
  'question ids must be unique'
);
SELECT throws_ok(
  $$INSERT INTO public.polls (title, questions) VALUES ('x', '[{"id":"q1","text":"Q","options":["A","B"],"correct_option":"A"}]')$$,
  '23514',
  NULL,
  'the correct option cannot be stored in the public questions'
);

-- -----------------------------------------------------------------------------
-- Attention check
-- -----------------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.poll_attention_checks (poll_id, question_id, correct_option) VALUES ('poll0001', 'q2', 'Green')$$,
  '23514',
  NULL,
  'the attention check must name an existing option'
);
INSERT INTO public.poll_attention_checks (poll_id, question_id, correct_option)
VALUES ('poll0001', 'q2', 'Purple');
SELECT is(
  (SELECT correct_option FROM public.poll_attention_checks WHERE poll_id = 'poll0001'),
  'Purple',
  'the owner can set and read the attention check'
);

-- -----------------------------------------------------------------------------
-- save_poll: a poll and its attention check are saved together or not at all
-- -----------------------------------------------------------------------------
SELECT matches(
  public.save_poll(
    NULL,
    '{"title":"Saved together","questions":[{"id":"q1","text":"Pick B","options":["A","B"]}]}',
    '{"question_id":"q1","correct_option":"B"}'
  ),
  '^[A-Za-z0-9]{8}$',
  'save_poll creates a draft with its attention check'
);
SELECT is(
  (SELECT c.correct_option FROM public.poll_attention_checks c
   JOIN public.polls p ON p.id = c.poll_id WHERE p.title = 'Saved together'),
  'B',
  'the attention check is stored with the new poll'
);
SELECT throws_ok(
  $$SELECT public.save_poll(NULL,
    '{"title":"Half saved","questions":[{"id":"q1","text":"Pick B","options":["A","B"]}]}',
    '{"question_id":"q1","correct_option":"C"}')$$,
  '23514',
  NULL,
  'save_poll rejects an attention check that names a missing option'
);
SELECT is_empty(
  $$SELECT 1 FROM public.polls WHERE title = 'Half saved'$$,
  'a rejected attention check leaves no poll behind'
);
SELECT throws_ok(
  $$SELECT public.save_poll(
    (SELECT id FROM public.polls WHERE title = 'Saved together'),
    '{"title":"Saved together","questions":[{"id":"q1","text":"Pick C","options":["A","C"]}]}',
    '{"question_id":"q1","correct_option":"B"}')$$,
  '23514',
  NULL,
  'an edit whose attention check does not fit the new questions is rejected'
);
SELECT is(
  (SELECT c.correct_option || '/' || (p.questions -> 0 ->> 'text')
   FROM public.poll_attention_checks c
   JOIN public.polls p ON p.id = c.poll_id WHERE p.title = 'Saved together'),
  'B/Pick B',
  'a rejected edit keeps the previous questions and attention check'
);

RESET ROLE;
SELECT pg_temp.act_as('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$SELECT public.save_poll('poll0001',
    '{"title":"Hijacked","questions":[{"id":"q1","text":"Q","options":["A","B"]}]}', NULL)$$,
  '23514',
  'This poll could not be found',
  'save_poll cannot edit another user''s poll'
);
RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');

-- -----------------------------------------------------------------------------
-- Drafts are private and not answerable
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as('22222222-2222-2222-2222-222222222222');
SELECT is_empty(
  $$SELECT 1 FROM public.polls WHERE id = 'poll0001'$$,
  'another user cannot see a draft'
);

RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT is_empty(
  $$SELECT 1 FROM public.polls WHERE id = 'poll0001'$$,
  'anonymous visitors cannot see a draft'
);
SELECT throws_ok(
  $$SELECT * FROM public.submit_response('poll0001', '{"q1":"Walk","q2":"Purple"}')$$,
  '23514',
  'This poll is not accepting answers',
  'a draft does not accept answers'
);
SELECT is(
  public.poll_response_count('poll0001'),
  0,
  'the count of someone else''s draft is not revealed'
);

-- -----------------------------------------------------------------------------
-- Editing and opening
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as('22222222-2222-2222-2222-222222222222');
UPDATE public.polls SET title = 'Hijacked' WHERE id = 'poll0001';

RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT is(
  (SELECT title FROM public.polls WHERE id = 'poll0001'),
  'Commute',
  'another user cannot edit the poll'
);

UPDATE public.polls SET title = 'Commute to WHU' WHERE id = 'poll0001';
SELECT is(
  (SELECT title FROM public.polls WHERE id = 'poll0001'),
  'Commute to WHU',
  'the owner can edit a draft'
);

SELECT throws_ok(
  $$UPDATE public.polls SET status = 'closed' WHERE id = 'poll0001'$$,
  '23514',
  NULL,
  'a draft cannot be closed directly'
);

-- Editing a question so the attention check no longer fits blocks opening.
UPDATE public.polls
SET questions = '[{"id":"q1","text":"How did you get here?","options":["Walk","Bike"]},
                  {"id":"q2","text":"Pick Blue","options":["Red","Blue"]}]'
WHERE id = 'poll0001';
SELECT throws_ok(
  $$UPDATE public.polls SET status = 'open' WHERE id = 'poll0001'$$,
  '23514',
  'The attention check refers to a question or option that no longer exists',
  'a poll whose attention check no longer fits cannot be opened'
);
UPDATE public.polls
SET questions = '[{"id":"q1","text":"How did you get here?","options":["Walk","Bike"]},
                  {"id":"q2","text":"Pick Purple","options":["Red","Purple"]}]'
WHERE id = 'poll0001';

UPDATE public.polls SET status = 'open' WHERE id = 'poll0001';
SELECT isnt(
  (SELECT opened_at FROM public.polls WHERE id = 'poll0001'),
  NULL,
  'opening a poll records when it was opened'
);
SELECT throws_ok(
  $$UPDATE public.polls SET questions = '[{"id":"q1","text":"Q","options":["A","B"]}]' WHERE id = 'poll0001'$$,
  '23514',
  'The plan of an opened poll cannot be changed',
  'the questions of an open poll are fixed'
);
SELECT throws_ok(
  $$UPDATE public.polls SET authors = '[{"name":"Someone else","affiliation":""}]' WHERE id = 'poll0001'$$,
  '23514',
  'The plan of an opened poll cannot be changed',
  'the authors of an open poll are fixed'
);
SELECT throws_ok(
  $$UPDATE public.poll_attention_checks SET correct_option = 'Red' WHERE poll_id = 'poll0001'$$,
  '23514',
  'The attention check of an opened poll cannot be changed',
  'the attention check of an open poll is fixed'
);
SELECT throws_ok(
  $$UPDATE public.polls SET status = 'draft' WHERE id = 'poll0001'$$,
  '23514',
  NULL,
  'an open poll cannot go back to draft'
);

DELETE FROM public.polls WHERE id = 'poll0001';
SELECT isnt_empty(
  $$SELECT 1 FROM public.polls WHERE id = 'poll0001'$$,
  'the owner cannot delete an open poll'
);

-- -----------------------------------------------------------------------------
-- Answering
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT is_empty(
  $$SELECT 1 FROM public.polls$$,
  'anonymous visitors cannot list polls, not even open ones'
);
SELECT is(
  (SELECT title FROM public.get_public_poll('poll0001')),
  'Commute to WHU',
  'anonymous visitors can read an open poll through get_public_poll'
);
SELECT is(
  (SELECT count(*)::integer FROM public.get_public_poll(
    (SELECT id FROM public.polls WHERE title = 'Saved together'))),
  0,
  'get_public_poll does not return drafts'
);
SELECT is_empty(
  $$SELECT 1 FROM public.poll_attention_checks WHERE poll_id = 'poll0001'$$,
  'anonymous visitors cannot see the attention check''s answer'
);
SELECT is(
  (SELECT seq FROM public.submit_response('poll0001', '{"q1":"Walk","q2":"Purple"}')),
  1,
  'the first answer gets number 1'
);
SELECT is(
  (SELECT seq FROM public.submit_response('poll0001', '{"q1":"Bike","q2":"Red"}')),
  2,
  'the second answer gets number 2'
);
SELECT is(
  (SELECT seq FROM public.submit_response('poll0001', '{"q1":"Walk","q2":"Red"}',
    'aaaaaaaa-0000-0000-0000-000000000001')),
  3,
  'an answer with a client id gets the next number'
);
SELECT is(
  (SELECT seq FROM public.submit_response('poll0001', '{"q1":"Walk","q2":"Red"}',
    'aaaaaaaa-0000-0000-0000-000000000001')),
  3,
  'submitting the same form again returns the saved answer'
);
SELECT is(
  public.poll_response_count('poll0001'),
  3,
  'a retried submit does not add a duplicate answer'
);
SELECT throws_ok(
  $$SELECT * FROM public.submit_response('poll0001', '{"q1":"Car","q2":"Red"}')$$,
  '23514',
  'Missing or invalid answer for question q1',
  'an option that is not in the question is rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.submit_response('poll0001', '{"q1":"Walk"}')$$,
  '23514',
  'Missing or invalid answer for question q2',
  'an unanswered question is rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.submit_response('poll0001', '{"q1":"Walk","q2":"Red","q9":"x"}')$$,
  '23514',
  'Answers contain unknown questions',
  'an unknown question is rejected'
);
SELECT throws_ok(
  $$SELECT * FROM public.submit_response('poll0001', '{"q1":["Walk"],"q2":"Red"}')$$,
  '23514',
  'Missing or invalid answer for question q1',
  'an answer must be text, not a list'
);
SELECT throws_ok(
  $$INSERT INTO public.responses (poll_id, seq, answers) VALUES ('poll0001', 99, '{"q1":"Walk","q2":"Red"}')$$,
  NULL,
  NULL,
  'answers cannot be inserted directly, only through submit_response'
);
SELECT is(
  public.poll_response_count('poll0001'),
  3,
  'anyone can see how many answers an open poll has'
);
SELECT is_empty(
  $$SELECT 1 FROM public.responses WHERE poll_id = 'poll0001'$$,
  'anonymous visitors cannot read answers'
);

-- -----------------------------------------------------------------------------
-- Reading and protecting answers
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as('22222222-2222-2222-2222-222222222222');
SELECT is_empty(
  $$SELECT 1 FROM public.responses WHERE poll_id = 'poll0001'$$,
  'another user cannot read the answers'
);
SELECT is_empty(
  $$SELECT 1 FROM public.polls WHERE id = 'poll0001'$$,
  'another user cannot read someone else''s open poll'
);

RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
SELECT is(
  (SELECT count(*)::integer FROM public.responses WHERE poll_id = 'poll0001'),
  3,
  'the owner can read the answers'
);

-- From here on as the database owner, which bypasses row-level security:
-- the rules below must hold even for the server and admins.
RESET ROLE;
SELECT throws_ok(
  $$UPDATE public.responses SET answers = '{"q1":"Bike","q2":"Purple"}' WHERE poll_id = 'poll0001' AND seq = 1$$,
  '23514',
  'Answers cannot be changed',
  'nobody can change an answer, not even the database owner'
);
SELECT throws_ok(
  $$DELETE FROM public.responses WHERE poll_id = 'poll0001' AND seq = 2$$,
  '23514',
  'Answers cannot be deleted',
  'nobody can delete an answer, not even the database owner'
);
SELECT throws_ok(
  $$TRUNCATE public.responses CASCADE$$,
  '23514',
  'Answers cannot be deleted',
  'the answers table cannot be truncated'
);
SELECT throws_ok(
  $$DELETE FROM public.polls WHERE id = 'poll0001'$$,
  '23514',
  'Only draft polls can be deleted',
  'nobody can delete an open poll and its answers, not even the database owner'
);
SELECT throws_ok(
  $$INSERT INTO public.responses (poll_id, seq, answers) VALUES ('poll0001', 99, '{"q1":"Walk","q2":"Bananas"}')$$,
  '23514',
  'Missing or invalid answer for question q2',
  'direct inserts by the server are validated too'
);
INSERT INTO public.responses (poll_id, seq, answers) VALUES ('poll0001', 99, '{"q1":"Walk","q2":"Red"}');
SELECT is(
  (SELECT max(seq) FROM public.responses WHERE poll_id = 'poll0001'),
  4,
  'direct inserts by the server are numbered by the database, not by the caller'
);
SELECT throws_ok(
  $$UPDATE public.responses SET client_id = 'bbbbbbbb-0000-0000-0000-000000000001' WHERE poll_id = 'poll0001' AND seq = 3$$,
  '23514',
  'Answers cannot be changed',
  'the client id of an answer cannot be changed'
);

-- -----------------------------------------------------------------------------
-- Closing
-- -----------------------------------------------------------------------------
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
UPDATE public.polls SET status = 'closed' WHERE id = 'poll0001';
SELECT isnt(
  (SELECT closed_at FROM public.polls WHERE id = 'poll0001'),
  NULL,
  'closing a poll records when it was closed'
);

RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT throws_ok(
  $$SELECT * FROM public.submit_response('poll0001', '{"q1":"Walk","q2":"Purple"}')$$,
  '23514',
  'This poll is not accepting answers',
  'a closed poll does not accept answers'
);

-- -----------------------------------------------------------------------------
-- Deleting drafts and accounts
-- -----------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-1111-1111-111111111111');
DELETE FROM public.polls WHERE title = 'Generated id';
SELECT is_empty(
  $$SELECT 1 FROM public.polls WHERE title = 'Generated id'$$,
  'the owner can delete a draft'
);

-- Deleting the researcher's account is the one way answers disappear: the
-- foreign keys cascade through polls, attention checks and answers.
RESET ROLE;
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is_empty(
  $$SELECT 1 FROM public.responses WHERE poll_id = 'poll0001'$$,
  'deleting the owner account removes their polls and answers'
);

SELECT * FROM finish();
ROLLBACK;
