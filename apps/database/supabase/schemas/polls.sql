-- =============================================================================
-- Polls and responses
--
-- A poll is created as a draft, opened once (which fixes its plan and
-- questions), and closed once. Answers can only be added to an open poll,
-- and nobody can change or delete them.
--
-- Rules live in triggers rather than in CHECK constraints that call functions
-- or in grants: the schema diff orders functions after tables, and it does not
-- carry REVOKE statements over Supabase's default privileges.
-- =============================================================================

CREATE TYPE public.poll_status AS ENUM ('draft', 'open', 'closed');

-- questions: [{"id": "q1", "text": "…", "options": ["A", "B"]}], validated by
--   validate_poll_questions() on every insert and update.
-- exclusion_rules: {"text": "…", "exclude_failed_attention_check": true}
-- authors: [{"name": "…", "affiliation": "…"}]
-- planned_n is the registered sample size. It is shown next to the count but
--   not enforced: answers beyond it are still recorded, and visibly so.
CREATE TABLE IF NOT EXISTS public.polls (
  -- Short random ID for URLs and QR codes: 8 letters/digits from random bytes.
  id text PRIMARY KEY DEFAULT substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', ''), 1, 8),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  planned_n integer CHECK (planned_n IS NULL OR planned_n BETWEEN 1 AND 100000),
  questions jsonb NOT NULL CHECK (
    jsonb_typeof(questions) = 'array'
    AND jsonb_array_length(questions) BETWEEN 1 AND 10
  ),
  exclusion_rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(exclusion_rules) = 'object' AND pg_column_size(exclusion_rules) < 20000
  ),
  authors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(authors) = 'array' AND pg_column_size(authors) < 20000
  ),
  status public.poll_status NOT NULL DEFAULT 'draft',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS polls_owner_id_created_at_idx
  ON public.polls (owner_id, created_at DESC);

-- The correct option of the attention-check question. Kept out of
-- polls.questions because open polls are readable by anyone, and a visible
-- answer would make the check useless. Only the owner can read it.
CREATE TABLE IF NOT EXISTS public.poll_attention_checks (
  poll_id text PRIMARY KEY REFERENCES public.polls (id) ON DELETE CASCADE,
  question_id text NOT NULL,
  correct_option text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.responses (
  -- Goes into the exported CSV as response_id: 12 letters/digits.
  id text PRIMARY KEY DEFAULT substr(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', ''), 1, 12),
  poll_id text NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  seq integer NOT NULL CHECK (seq > 0),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT responses_poll_id_seq_key UNIQUE (poll_id, seq)
);

-- -----------------------------------------------------------------------------
-- Question validation. An open poll's questions can never be fixed, so a
-- malformed one would leave a poll nobody can answer.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_poll_questions(p_questions jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_question jsonb;
  v_option jsonb;
  v_ids text[] := '{}';
  v_options text[];
BEGIN
  IF jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'Questions must be a list' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_question IN SELECT * FROM jsonb_array_elements(p_questions) LOOP
    IF jsonb_typeof(v_question) <> 'object'
      OR jsonb_typeof(v_question -> 'id') IS DISTINCT FROM 'string'
      OR (v_question ->> 'id') !~ '^[a-z0-9_]{1,20}$'
      OR jsonb_typeof(v_question -> 'text') IS DISTINCT FROM 'string'
      OR char_length(btrim(v_question ->> 'text')) NOT BETWEEN 1 AND 500
      OR jsonb_typeof(v_question -> 'options') IS DISTINCT FROM 'array'
      OR jsonb_array_length(v_question -> 'options') NOT BETWEEN 2 AND 8
      OR (SELECT count(*) FROM jsonb_object_keys(v_question)) <> 3 THEN
      RAISE EXCEPTION 'Each question needs an id, a text and 2 to 8 options'
        USING ERRCODE = 'check_violation';
    END IF;

    IF (v_question ->> 'id') = ANY (v_ids) THEN
      RAISE EXCEPTION 'Question ids must be unique' USING ERRCODE = 'check_violation';
    END IF;
    v_ids := v_ids || (v_question ->> 'id');

    v_options := '{}';
    FOR v_option IN SELECT * FROM jsonb_array_elements(v_question -> 'options') LOOP
      IF jsonb_typeof(v_option) <> 'string'
        OR char_length(btrim(v_option #>> '{}')) NOT BETWEEN 1 AND 200 THEN
        RAISE EXCEPTION 'Options must be text of 1 to 200 characters'
          USING ERRCODE = 'check_violation';
      END IF;
      IF (v_option #>> '{}') = ANY (v_options) THEN
        RAISE EXCEPTION 'Options of a question must be unique' USING ERRCODE = 'check_violation';
      END IF;
      v_options := v_options || (v_option #>> '{}');
    END LOOP;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Poll lifecycle: content is editable only while draft; status only moves
-- draft -> open -> closed, and the timestamps are set by the database.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_poll_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.validate_poll_questions(NEW.questions);
  NEW.status := 'draft';
  NEW.opened_at := NULL;
  NEW.closed_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_poll_insert
  BEFORE INSERT ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_poll_insert();

CREATE OR REPLACE FUNCTION public.guard_poll_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_check public.poll_attention_checks;
BEGIN
  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'id, owner and creation time of a poll cannot change'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status <> 'draft' AND (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.planned_n IS DISTINCT FROM OLD.planned_n
    OR NEW.questions IS DISTINCT FROM OLD.questions
    OR NEW.exclusion_rules IS DISTINCT FROM OLD.exclusion_rules
  ) THEN
    RAISE EXCEPTION 'The plan of an opened poll cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.questions IS DISTINCT FROM OLD.questions THEN
    PERFORM public.validate_poll_questions(NEW.questions);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'draft' AND NEW.status = 'open' THEN
      -- The attention check must still match the questions it was set for.
      SELECT * INTO v_check FROM public.poll_attention_checks c WHERE c.poll_id = NEW.id;
      IF FOUND AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.questions) q
        WHERE q ->> 'id' = v_check.question_id
          AND (q -> 'options') ? v_check.correct_option
      ) THEN
        RAISE EXCEPTION 'The attention check refers to a question or option that no longer exists'
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.opened_at := now();
    ELSIF OLD.status = 'open' AND NEW.status = 'closed' THEN
      NEW.closed_at := now();
    ELSE
      RAISE EXCEPTION 'A poll cannot go from % to %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    NEW.opened_at := OLD.opened_at;
    NEW.closed_at := OLD.closed_at;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_poll_update
  BEFORE UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_poll_update();

-- Only drafts can be deleted, by anyone (RLS adds "only by the owner"). The
-- exception is the owner's account being deleted, which cascades.
CREATE OR REPLACE FUNCTION public.guard_poll_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Polls cannot be truncated' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status <> 'draft'
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.owner_id) THEN
    RAISE EXCEPTION 'Only draft polls can be deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER guard_poll_delete
  BEFORE DELETE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_poll_delete();

CREATE TRIGGER guard_poll_truncate
  BEFORE TRUNCATE ON public.polls
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.guard_poll_delete();

-- The attention check can only be set, changed or removed while the poll is
-- a draft, and must point at an existing question and option.
CREATE OR REPLACE FUNCTION public.guard_poll_attention_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_poll public.polls;
BEGIN
  SELECT * INTO v_poll FROM public.polls p
  WHERE p.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.poll_id ELSE NEW.poll_id END;

  -- Poll already gone: this is its cascade.
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  IF v_poll.status <> 'draft' THEN
    RAISE EXCEPTION 'The attention check of an opened poll cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_poll.questions) q
    WHERE q ->> 'id' = NEW.question_id
      AND (q -> 'options') ? NEW.correct_option
  ) THEN
    RAISE EXCEPTION 'The attention check must name one of the poll''s questions and options'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_poll_attention_check
  BEFORE INSERT OR UPDATE OR DELETE ON public.poll_attention_checks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_poll_attention_check();

-- -----------------------------------------------------------------------------
-- Answers. Every insert, by any role and through any path, goes through
-- prepare_response(): the poll must be open (its row is locked so a close
-- waits for answers in flight), every question needs exactly one valid
-- option given as text, and answers are numbered 1, 2, 3 … per poll.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_response()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_poll public.polls;
  v_question jsonb;
  v_answer jsonb;
BEGIN
  SELECT * INTO v_poll FROM public.polls p WHERE p.id = NEW.poll_id FOR SHARE;
  IF NOT FOUND OR v_poll.status <> 'open' THEN
    RAISE EXCEPTION 'This poll is not accepting answers'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.answers IS NULL OR jsonb_typeof(NEW.answers) <> 'object' THEN
    RAISE EXCEPTION 'Answers must be an object' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_question IN SELECT * FROM jsonb_array_elements(v_poll.questions) LOOP
    v_answer := NEW.answers -> (v_question ->> 'id');
    IF v_answer IS NULL
      OR jsonb_typeof(v_answer) <> 'string'
      OR NOT ((v_question -> 'options') ? (v_answer #>> '{}')) THEN
      RAISE EXCEPTION 'Missing or invalid answer for question %', v_question ->> 'id'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM jsonb_object_keys(NEW.answers)) <> jsonb_array_length(v_poll.questions) THEN
    RAISE EXCEPTION 'Answers contain unknown questions' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('responses:' || NEW.poll_id));
  SELECT coalesce(max(r.seq), 0) + 1 INTO NEW.seq
  FROM public.responses r WHERE r.poll_id = NEW.poll_id;
  -- Taken after the lock, so times follow the numbering.
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_response
  BEFORE INSERT ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_response();

-- The participant-facing way to answer: anonymous visitors have no insert
-- policy on responses, so they go through this function.
CREATE OR REPLACE FUNCTION public.submit_response(p_poll_id text, p_answers jsonb)
RETURNS TABLE (id text, seq integer, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    INSERT INTO public.responses AS r (poll_id, seq, answers)
    VALUES (p_poll_id, 1, p_answers)  -- seq is replaced by prepare_response()
    RETURNING r.id, r.seq, r.created_at;
END;
$$;

-- Number of answers to an open or closed poll (or to one's own poll),
-- without exposing the answers themselves.
CREATE OR REPLACE FUNCTION public.poll_response_count(p_poll_id text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.responses r
  JOIN public.polls p ON p.id = r.poll_id
  WHERE r.poll_id = p_poll_id
    AND (p.status <> 'draft' OR p.owner_id = (SELECT auth.uid()));
$$;

-- -----------------------------------------------------------------------------
-- Answers are permanent: no updates to what was answered, no deletes, no
-- truncate, for every role. Deleting a whole poll (only possible as part of
-- deleting the owner's account) still cascades.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.forbid_response_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id
      OR NEW.poll_id <> OLD.poll_id
      OR NEW.seq <> OLD.seq
      OR NEW.answers <> OLD.answers
      OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'Answers cannot be changed' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Answers cannot be deleted' USING ERRCODE = 'check_violation';
  END IF;

  -- A delete is only allowed when the poll itself is already gone (cascade).
  IF EXISTS (SELECT 1 FROM public.polls p WHERE p.id = OLD.poll_id) THEN
    RAISE EXCEPTION 'Answers cannot be deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER forbid_response_update_delete
  BEFORE UPDATE OR DELETE ON public.responses
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_response_changes();

CREATE TRIGGER forbid_response_truncate
  BEFORE TRUNCATE ON public.responses
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.forbid_response_changes();

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_attention_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY polls_select_policy ON public.polls
  FOR SELECT USING (status <> 'draft' OR owner_id = (SELECT auth.uid()));

CREATE POLICY polls_insert_policy ON public.polls
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY polls_update_policy ON public.polls
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY polls_delete_policy ON public.polls
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND status = 'draft');

-- Owner-only, for every operation.
CREATE POLICY poll_attention_checks_owner_policy ON public.poll_attention_checks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_attention_checks.poll_id AND p.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = poll_attention_checks.poll_id AND p.owner_id = (SELECT auth.uid())
    )
  );

-- Only the poll's owner can read its answers. There are no insert, update
-- or delete policies: answers are added by submit_response() only.
CREATE POLICY responses_select_policy ON public.responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = responses.poll_id AND p.owner_id = (SELECT auth.uid())
    )
  );
