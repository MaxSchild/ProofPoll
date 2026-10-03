-- =============================================================================
-- Papers and their verification (prototype spec §12)
--
-- A paper groups one or more of a researcher's polls. For each review round
-- the researcher uploads their manuscript; the numbers it reports per study
-- (N, exclusions, results) are extracted, confirmed by the researcher, and
-- checked against the recorded answers. Each round is a version with its own
-- unlisted review link. Attaching a DOI publishes the paper.
--
-- Verdicts are computed here, inside confirm_paper_version(), from the stored
-- answers. Researchers can read their verdicts but never write them: the
-- version, number and verdict tables have no insert, update or delete
-- policies, and every write goes through the functions below.
--
-- Functions that must act on behalf of the system (publishing a paper after
-- an unanswered DOI match, marking it "matched automatically") run as
-- SECURITY DEFINER. Triggers tell them apart from API requests by
-- current_user, which is anon or authenticated only for requests from the API.
-- =============================================================================

CREATE TYPE public.paper_status AS ENUM ('draft', 'in_review', 'published');

-- authors: [{"name": "…", "affiliation": "…"}]
-- doi: set when the paper is published, stored in lower case.
-- auto_matched: published by the daily DOI detection without the researcher's
--   reply within 14 days.
-- results_public: per-question results are shown on the public page.
CREATE TABLE IF NOT EXISTS public.papers (
  id text PRIMARY KEY DEFAULT substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', ''), 1, 8),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  authors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(authors) = 'array' AND pg_column_size(authors) < 20000
  ),
  status public.paper_status NOT NULL DEFAULT 'draft',
  doi text CHECK (doi IS NULL OR doi ~ '^10\.[0-9]{4,9}/\S{1,200}$'),
  published_at timestamptz,
  auto_matched boolean NOT NULL DEFAULT false,
  results_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS papers_owner_id_created_at_idx
  ON public.papers (owner_id, created_at DESC);

-- A poll belongs to at most one paper.
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS paper_id text REFERENCES public.papers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS polls_paper_id_idx ON public.polls (paper_id);

-- One review round. The manuscript itself is never stored: only its SHA-256,
-- so a reviewer can tell that their copy is the file that was checked.
-- confirmed_at is null while the researcher still has to confirm the
-- extracted numbers; the review link only works once it is set.
CREATE TABLE IF NOT EXISTS public.paper_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id text NOT NULL REFERENCES public.papers (id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  -- Unlisted review link: 24 letters/digits from random bytes.
  review_token text NOT NULL UNIQUE DEFAULT substr(translate(encode(extensions.gen_random_bytes(30), 'base64'), '+/=', ''), 1, 24),
  manuscript_sha256 text NOT NULL CHECK (manuscript_sha256 ~ '^[0-9a-f]{64}$'),
  manuscript_name text NOT NULL CHECK (char_length(manuscript_name) BETWEEN 1 AND 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT paper_versions_paper_id_version_key UNIQUE (paper_id, version)
);

-- What the manuscript reports for one study (poll). extracted holds what the
-- extraction proposed; the reported_* columns what the researcher confirmed.
-- reported_results: {"q1": {"Coffee": 57, "Tea": 43}}, percent per option.
CREATE TABLE IF NOT EXISTS public.version_study_numbers (
  version_id uuid NOT NULL REFERENCES public.paper_versions (id) ON DELETE CASCADE,
  poll_id text NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  reported_n integer CHECK (reported_n IS NULL OR reported_n >= 0),
  reported_exclusions integer CHECK (reported_exclusions IS NULL OR reported_exclusions >= 0),
  reported_results jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(reported_results) = 'object'),
  PRIMARY KEY (version_id, poll_id)
);

-- The verdict for one study in one version.
-- details: {"count": {...}, "results": {...}, "dataset": {...}}, see
--   validate_study().
CREATE TABLE IF NOT EXISTS public.validation_results (
  version_id uuid NOT NULL REFERENCES public.paper_versions (id) ON DELETE CASCADE,
  poll_id text NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('consistent', 'inconsistent', 'not_checkable')),
  levels_run text[] NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version_id, poll_id)
);

-- A published paper found by the daily literature check for a paper still in
-- review. Without the researcher's reply by confirm_by, the paper is
-- published anyway, marked as matched automatically.
CREATE TABLE IF NOT EXISTS public.doi_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id text NOT NULL REFERENCES public.papers (id) ON DELETE CASCADE,
  doi text NOT NULL CHECK (doi ~ '^10\.[0-9]{4,9}/\S{1,200}$'),
  matched_title text NOT NULL,
  source text NOT NULL CHECK (source IN ('crossref', 'openalex')),
  reason text NOT NULL CHECK (reason IN ('cites_link', 'title_authors')),
  matched_at timestamptz NOT NULL DEFAULT now(),
  confirm_by timestamptz NOT NULL DEFAULT now() + interval '14 days',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'auto_published'))
);

CREATE INDEX IF NOT EXISTS doi_matches_paper_id_idx ON public.doi_matches (paper_id);

-- At most one open question to the researcher per paper.
CREATE UNIQUE INDEX IF NOT EXISTS doi_matches_one_pending_idx
  ON public.doi_matches (paper_id) WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- Paper lifecycle
-- -----------------------------------------------------------------------------

-- True for requests that come straight from the API, false inside the
-- SECURITY DEFINER functions of this file.
CREATE OR REPLACE FUNCTION public.is_api_request()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT current_user IN ('anon', 'authenticated');
$$;

CREATE OR REPLACE FUNCTION public.guard_paper_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.status := 'draft';
  NEW.doi := NULL;
  NEW.published_at := NULL;
  NEW.auto_matched := false;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_paper_insert
  BEFORE INSERT ON public.papers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_paper_insert();

-- Title and authors can change while the paper is a draft. A paper goes to
-- review only through confirm_paper_version(). Publishing needs a DOI and
-- is final. The results opt-in can change at any time.
CREATE OR REPLACE FUNCTION public.guard_paper_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'id, owner and creation time of a paper cannot change'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status <> 'draft' AND (
    NEW.title IS DISTINCT FROM OLD.title OR NEW.authors IS DISTINCT FROM OLD.authors
  ) THEN
    RAISE EXCEPTION 'Title and authors can only change before the first review round'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'draft' AND NEW.status = 'in_review' THEN
      IF public.is_api_request() THEN
        RAISE EXCEPTION 'A paper goes to review by confirming a review version'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSIF OLD.status = 'in_review' AND NEW.status = 'published' THEN
      IF NEW.doi IS NULL THEN
        RAISE EXCEPTION 'A DOI is needed to publish a paper' USING ERRCODE = 'check_violation';
      END IF;
      NEW.doi := lower(NEW.doi);
      NEW.published_at := now();
      IF public.is_api_request() THEN
        NEW.auto_matched := false;
      END IF;
    ELSE
      RAISE EXCEPTION 'A paper cannot go from % to %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.doi IS DISTINCT FROM OLD.doi THEN
      RAISE EXCEPTION 'The DOI is set when the paper is published and cannot change'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.published_at := OLD.published_at;
    NEW.auto_matched := OLD.auto_matched;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_paper_update
  BEFORE UPDATE ON public.papers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_paper_update();

-- Only drafts can be deleted, except when the owner's account is deleted.
CREATE OR REPLACE FUNCTION public.guard_paper_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Papers cannot be truncated' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status <> 'draft'
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.owner_id) THEN
    RAISE EXCEPTION 'Only draft papers can be deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER guard_paper_delete
  BEFORE DELETE ON public.papers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_paper_delete();

CREATE TRIGGER guard_paper_truncate
  BEFORE TRUNCATE ON public.papers
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.guard_paper_delete();

-- A poll joins or leaves a paper only while that paper is a draft, only if
-- both have the same owner, and only once the poll has been opened (a draft
-- poll has no registered plan yet).
CREATE OR REPLACE FUNCTION public.guard_poll_paper()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_paper public.papers;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.paper_id IS NOT DISTINCT FROM OLD.paper_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.paper_id IS NOT NULL THEN
    SELECT * INTO v_paper FROM public.papers p WHERE p.id = OLD.paper_id;
    -- Not found: the paper is being deleted and this is its SET NULL.
    IF FOUND AND v_paper.status <> 'draft' THEN
      RAISE EXCEPTION 'Polls cannot be removed from a paper that has gone to review'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.paper_id IS NOT NULL THEN
    IF NEW.status = 'draft' THEN
      RAISE EXCEPTION 'Only opened or closed polls can be added to a paper'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_paper FROM public.papers p WHERE p.id = NEW.paper_id;
    IF NOT FOUND OR v_paper.owner_id <> NEW.owner_id THEN
      RAISE EXCEPTION 'This paper could not be found' USING ERRCODE = 'check_violation';
    END IF;
    IF v_paper.status <> 'draft' THEN
      RAISE EXCEPTION 'Polls cannot be added to a paper that has gone to review'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_poll_paper
  BEFORE INSERT OR UPDATE ON public.polls
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_poll_paper();

-- Saving a draft paper and the set of its polls in one transaction. Runs as
-- the caller, so row-level security decides whose papers and polls change.
-- p_paper: {title, authors}. Returns the paper id.
CREATE OR REPLACE FUNCTION public.save_paper(p_id text, p_paper jsonb, p_poll_ids text[])
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_id text;
  v_found integer;
BEGIN
  IF coalesce(cardinality(p_poll_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Choose at least one poll' USING ERRCODE = 'check_violation';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.papers (title, authors)
    VALUES (p_paper ->> 'title', coalesce(p_paper -> 'authors', '[]'::jsonb))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.papers p
    SET title = p_paper ->> 'title',
        authors = coalesce(p_paper -> 'authors', '[]'::jsonb)
    WHERE p.id = p_id
    RETURNING p.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'This paper could not be found' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.polls p SET paper_id = NULL
    WHERE p.paper_id = v_id AND NOT (p.id = ANY (p_poll_ids));
  END IF;

  UPDATE public.polls p SET paper_id = v_id
  WHERE p.id = ANY (p_poll_ids) AND p.paper_id IS NULL;

  SELECT count(*) INTO v_found FROM public.polls p
  WHERE p.id = ANY (p_poll_ids) AND p.paper_id = v_id;
  IF v_found <> cardinality(p_poll_ids) THEN
    RAISE EXCEPTION 'Some polls could not be added: they belong to another paper or were not found'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- The validation function
-- -----------------------------------------------------------------------------

-- Checks what a paper reports for one poll against the recorded answers,
-- after the exclusions its registered rules allow. Runs every check the
-- inputs allow:
--   count:   reported N against recorded answers minus rule exclusions
--   results: reported % per option against the recorded distribution
--   dataset: needs a published dataset; not part of a review round yet
-- Returns {verdict, levels_run, details}.
CREATE OR REPLACE FUNCTION public.validate_study(
  p_poll_id text,
  p_reported_n integer,
  p_reported_exclusions integer,
  p_reported_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_poll public.polls;
  v_check public.poll_attention_checks;
  v_uses_check boolean;
  v_recorded integer;
  v_excluded integer := 0;
  v_expected integer;
  v_count jsonb;
  v_results jsonb;
  v_items jsonb := '[]'::jsonb;
  v_question jsonb;
  v_reported jsonb;
  v_option text;
  v_reported_pct numeric;
  v_recorded_pct numeric;
  v_option_count integer;
  v_all_ok boolean := true;
  v_levels text[] := '{}';
  v_verdicts text[] := '{}';
  v_verdict text;
BEGIN
  SELECT * INTO v_poll FROM public.polls p WHERE p.id = p_poll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This poll could not be found' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_check FROM public.poll_attention_checks c WHERE c.poll_id = p_poll_id;
  v_uses_check := FOUND
    AND (v_poll.exclusion_rules -> 'exclude_failed_attention_check') = 'true'::jsonb;

  SELECT count(*)::integer INTO v_recorded FROM public.responses r WHERE r.poll_id = p_poll_id;
  IF v_uses_check THEN
    SELECT count(*)::integer INTO v_excluded FROM public.responses r
    WHERE r.poll_id = p_poll_id
      AND (r.answers ->> v_check.question_id) IS DISTINCT FROM v_check.correct_option;
  END IF;
  v_expected := v_recorded - v_excluded;

  -- Count check. gap > 0: answers the paper doesn't account for; gap < 0:
  -- the paper reports more than the record holds after exclusions.
  IF p_reported_n IS NULL THEN
    v_count := jsonb_build_object(
      'ran', false, 'recorded', v_recorded, 'excluded_by_rule', v_excluded
    );
  ELSE
    v_count := jsonb_build_object(
      'ran', true,
      'recorded', v_recorded,
      'excluded_by_rule', v_excluded,
      'expected', v_expected,
      'reported_n', p_reported_n,
      'reported_exclusions', p_reported_exclusions,
      'gap', v_expected - p_reported_n,
      'verdict', CASE WHEN v_expected = p_reported_n THEN 'consistent' ELSE 'inconsistent' END
    );
    v_levels := v_levels || 'count'::text;
    v_verdicts := v_verdicts || (v_count ->> 'verdict');
  END IF;

  -- Results check, on the answers left after the registered exclusions.
  -- Papers round to whole percent, so a difference of up to 0.5 points
  -- counts as a match.
  IF p_reported_results IS NULL OR p_reported_results = '{}'::jsonb THEN
    v_results := jsonb_build_object('ran', false);
  ELSE
    FOR v_question IN SELECT * FROM jsonb_array_elements(v_poll.questions) LOOP
      v_reported := p_reported_results -> (v_question ->> 'id');
      CONTINUE WHEN v_reported IS NULL;
      FOR v_option IN SELECT jsonb_array_elements_text(v_question -> 'options') LOOP
        CONTINUE WHEN NOT (v_reported ? v_option);
        v_reported_pct := (v_reported ->> v_option)::numeric;
        SELECT count(*)::integer INTO v_option_count FROM public.responses r
        WHERE r.poll_id = p_poll_id
          AND r.answers ->> (v_question ->> 'id') = v_option
          AND (NOT v_uses_check
            OR (r.answers ->> v_check.question_id) IS NOT DISTINCT FROM v_check.correct_option);
        -- Compared unrounded; shown to one decimal.
        v_recorded_pct := CASE WHEN v_expected > 0
          THEN v_option_count * 100.0 / v_expected ELSE 0 END;
        v_items := v_items || jsonb_build_object(
          'question_id', v_question ->> 'id',
          'option', v_option,
          'reported', v_reported_pct,
          'recorded', round(v_recorded_pct, 1),
          'ok', abs(v_reported_pct - v_recorded_pct) <= 0.5
        );
        v_all_ok := v_all_ok AND abs(v_reported_pct - v_recorded_pct) <= 0.5;
      END LOOP;
    END LOOP;
    IF jsonb_array_length(v_items) = 0 THEN
      v_results := jsonb_build_object('ran', false);
    ELSE
      v_results := jsonb_build_object(
        'ran', true,
        'base', v_expected,
        'tolerance', 0.5,
        'items', v_items,
        'verdict', CASE WHEN v_all_ok THEN 'consistent' ELSE 'inconsistent' END
      );
      v_levels := v_levels || 'results'::text;
      v_verdicts := v_verdicts || (v_results ->> 'verdict');
    END IF;
  END IF;

  v_verdict := CASE
    WHEN cardinality(v_levels) = 0 THEN 'not_checkable'
    WHEN 'inconsistent' = ANY (v_verdicts) THEN 'inconsistent'
    ELSE 'consistent'
  END;

  RETURN jsonb_build_object(
    'verdict', v_verdict,
    'levels_run', to_jsonb(v_levels),
    'details', jsonb_build_object(
      'count', v_count,
      'results', v_results,
      'dataset', jsonb_build_object('ran', false)
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Review rounds
-- -----------------------------------------------------------------------------

-- The paper with this id, if it belongs to the caller. Used by the
-- SECURITY DEFINER functions below, which bypass row-level security.
CREATE OR REPLACE FUNCTION public.own_paper(p_paper_id text)
RETURNS public.papers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paper public.papers;
BEGIN
  SELECT * INTO v_paper FROM public.papers p
  WHERE p.id = p_paper_id AND p.owner_id = (SELECT auth.uid());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This paper could not be found' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_paper;
END;
$$;

-- Starts a review round from an uploaded manuscript: its fingerprint, file
-- name and the numbers extracted per poll
-- (p_extracted: {"<poll_id>": {reported_n, reported_exclusions, reported_results}}).
-- An unconfirmed round of the same paper is replaced. Returns the version id.
CREATE OR REPLACE FUNCTION public.create_paper_version(
  p_paper_id text,
  p_sha256 text,
  p_name text,
  p_extracted jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paper public.papers;
  v_version_id uuid;
  v_number integer;
  v_poll public.polls;
  v_found boolean := false;
  v_numbers jsonb;
BEGIN
  v_paper := public.own_paper(p_paper_id);
  IF v_paper.status = 'published' THEN
    RAISE EXCEPTION 'A published paper gets no new review rounds' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.polls p WHERE p.paper_id = p_paper_id AND p.status <> 'closed'
  ) THEN
    RAISE EXCEPTION 'Close all polls of this paper before sending it to review'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialises rounds of the same paper.
  PERFORM 1 FROM public.papers p WHERE p.id = p_paper_id FOR UPDATE;
  DELETE FROM public.paper_versions v WHERE v.paper_id = p_paper_id AND v.confirmed_at IS NULL;
  SELECT coalesce(max(v.version), 0) + 1 INTO v_number
  FROM public.paper_versions v WHERE v.paper_id = p_paper_id;

  INSERT INTO public.paper_versions (paper_id, version, manuscript_sha256, manuscript_name)
  VALUES (p_paper_id, v_number, lower(p_sha256), p_name)
  RETURNING id INTO v_version_id;

  FOR v_poll IN
    SELECT * FROM public.polls p WHERE p.paper_id = p_paper_id ORDER BY p.opened_at, p.id
  LOOP
    v_found := true;
    v_numbers := coalesce(p_extracted -> v_poll.id, '{}'::jsonb);
    INSERT INTO public.version_study_numbers (
      version_id, poll_id, extracted, reported_n, reported_exclusions, reported_results
    )
    VALUES (
      v_version_id,
      v_poll.id,
      v_numbers,
      (v_numbers ->> 'reported_n')::integer,
      (v_numbers ->> 'reported_exclusions')::integer,
      CASE WHEN jsonb_typeof(v_numbers -> 'reported_results') = 'object'
        THEN v_numbers -> 'reported_results' ELSE '{}'::jsonb END
    );
  END LOOP;

  IF NOT v_found THEN
    RAISE EXCEPTION 'Add at least one poll to this paper first' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_version_id;
END;
$$;

-- Removes a round the researcher has not confirmed yet.
CREATE OR REPLACE FUNCTION public.discard_paper_version(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version public.paper_versions;
BEGIN
  SELECT * INTO v_version FROM public.paper_versions v WHERE v.id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This review round could not be found' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM public.own_paper(v_version.paper_id);
  IF v_version.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'A confirmed review round cannot be removed' USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM public.paper_versions v WHERE v.id = p_version_id;
END;
$$;

-- The researcher confirms (or corrects) the numbers per poll
-- (p_numbers: {"<poll_id>": {reported_n, reported_exclusions, reported_results}}).
-- Every study is then validated against the record, the round gets its
-- review link, and the paper is in review.
CREATE OR REPLACE FUNCTION public.confirm_paper_version(p_version_id uuid, p_numbers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version public.paper_versions;
  v_paper public.papers;
  v_study public.version_study_numbers;
  v_poll public.polls;
  v_numbers jsonb;
  v_results jsonb;
  v_question_id text;
  v_options jsonb;
  v_option text;
  v_value jsonb;
  v_validation jsonb;
BEGIN
  SELECT * INTO v_version FROM public.paper_versions v WHERE v.id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This review round could not be found' USING ERRCODE = 'check_violation';
  END IF;
  v_paper := public.own_paper(v_version.paper_id);
  IF v_version.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This review round is already confirmed' USING ERRCODE = 'check_violation';
  END IF;
  IF v_paper.status = 'published' THEN
    RAISE EXCEPTION 'A published paper gets no new review rounds' USING ERRCODE = 'check_violation';
  END IF;

  -- The paper's polls may have changed since the upload (it is still a
  -- draft until now): the round must cover exactly its closed polls.
  PERFORM 1 FROM public.polls p WHERE p.paper_id = v_paper.id FOR SHARE;
  IF EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.paper_id = v_paper.id
      AND (p.status <> 'closed' OR NOT EXISTS (
        SELECT 1 FROM public.version_study_numbers s
        WHERE s.version_id = p_version_id AND s.poll_id = p.id
      ))
  ) OR EXISTS (
    SELECT 1 FROM public.version_study_numbers s
    JOIN public.polls p ON p.id = s.poll_id
    WHERE s.version_id = p_version_id AND p.paper_id IS DISTINCT FROM v_paper.id
  ) THEN
    RAISE EXCEPTION 'The polls of this paper changed since the upload. Upload the manuscript again.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_typeof(p_numbers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Numbers must be given per poll' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_study IN
    SELECT * FROM public.version_study_numbers s WHERE s.version_id = p_version_id
  LOOP
    SELECT * INTO v_poll FROM public.polls p WHERE p.id = v_study.poll_id;
    v_numbers := coalesce(p_numbers -> v_study.poll_id, '{}'::jsonb);

    IF jsonb_typeof(v_numbers -> 'reported_n') NOT IN ('number', 'null')
      OR jsonb_typeof(v_numbers -> 'reported_exclusions') NOT IN ('number', 'null')
      OR (v_numbers ->> 'reported_n')::numeric < 0
      OR (v_numbers ->> 'reported_exclusions')::numeric < 0
      OR (v_numbers ->> 'reported_n')::numeric % 1 <> 0
      OR (v_numbers ->> 'reported_exclusions')::numeric % 1 <> 0 THEN
      RAISE EXCEPTION 'N and exclusions must be whole numbers of 0 or more'
        USING ERRCODE = 'check_violation';
    END IF;

    v_results := coalesce(v_numbers -> 'reported_results', '{}'::jsonb);
    IF jsonb_typeof(v_results) <> 'object' THEN
      RAISE EXCEPTION 'Results must be given per question' USING ERRCODE = 'check_violation';
    END IF;
    FOR v_question_id, v_options IN SELECT * FROM jsonb_each(v_results) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_poll.questions) q WHERE q ->> 'id' = v_question_id
      ) OR jsonb_typeof(v_options) <> 'object' THEN
        RAISE EXCEPTION 'Results name a question that is not in poll "%"', v_poll.title
          USING ERRCODE = 'check_violation';
      END IF;
      FOR v_option, v_value IN SELECT * FROM jsonb_each(v_options) LOOP
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_poll.questions) q
          WHERE q ->> 'id' = v_question_id AND (q -> 'options') ? v_option
        ) THEN
          RAISE EXCEPTION 'Results name an option that is not in poll "%"', v_poll.title
            USING ERRCODE = 'check_violation';
        END IF;
        IF jsonb_typeof(v_value) <> 'number'
          OR (v_value #>> '{}')::numeric NOT BETWEEN 0 AND 100 THEN
          RAISE EXCEPTION 'Results must be percentages between 0 and 100'
            USING ERRCODE = 'check_violation';
        END IF;
      END LOOP;
    END LOOP;

    UPDATE public.version_study_numbers s
    SET reported_n = (v_numbers ->> 'reported_n')::integer,
        reported_exclusions = (v_numbers ->> 'reported_exclusions')::integer,
        reported_results = v_results
    WHERE s.version_id = p_version_id AND s.poll_id = v_study.poll_id;

    v_validation := public.validate_study(
      v_study.poll_id,
      (v_numbers ->> 'reported_n')::integer,
      (v_numbers ->> 'reported_exclusions')::integer,
      v_results
    );
    INSERT INTO public.validation_results (version_id, poll_id, verdict, levels_run, details)
    VALUES (
      p_version_id,
      v_study.poll_id,
      v_validation ->> 'verdict',
      ARRAY(SELECT jsonb_array_elements_text(v_validation -> 'levels_run')),
      v_validation -> 'details'
    );
  END LOOP;

  UPDATE public.paper_versions v SET confirmed_at = now() WHERE v.id = p_version_id;
  IF v_paper.status = 'draft' THEN
    UPDATE public.papers p SET status = 'in_review' WHERE p.id = v_paper.id;
  END IF;
END;
$$;

-- Versions, numbers and verdicts are written only by the functions above.
-- Once confirmed, a round never changes.
CREATE OR REPLACE FUNCTION public.guard_confirmed_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_version_id uuid;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'Review rounds cannot be truncated' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_TABLE_NAME = 'paper_versions' THEN
    IF OLD.confirmed_at IS NULL THEN
      RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;
    IF TG_OP = 'DELETE' THEN
      -- Allowed only as part of deleting the owner's account.
      IF EXISTS (SELECT 1 FROM public.papers p WHERE p.id = OLD.paper_id) THEN
        RAISE EXCEPTION 'A confirmed review round cannot be removed'
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'A confirmed review round cannot be changed' USING ERRCODE = 'check_violation';
  END IF;

  -- Deleting a closed poll only happens with the owner's account.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.polls p WHERE p.id = OLD.poll_id) THEN
    RETURN OLD;
  END IF;

  v_version_id := OLD.version_id;
  IF EXISTS (
    SELECT 1 FROM public.paper_versions v WHERE v.id = v_version_id AND v.confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A confirmed review round cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER guard_confirmed_version
  BEFORE UPDATE OR DELETE ON public.paper_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_version_truncate
  BEFORE TRUNCATE ON public.paper_versions
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_numbers
  BEFORE UPDATE OR DELETE ON public.version_study_numbers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_numbers_truncate
  BEFORE TRUNCATE ON public.version_study_numbers
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_validation
  BEFORE UPDATE OR DELETE ON public.validation_results
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_validation_truncate
  BEFORE TRUNCATE ON public.validation_results
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.guard_confirmed_version();

-- -----------------------------------------------------------------------------
-- Published DOI detection. The daily job (Crossref and OpenAlex) calls
-- record_doi_match(); in the prototype it is triggered from the paper page.
-- Returns the pending match, or null for a DOI the researcher rejected.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_doi_match(
  p_paper_id text,
  p_doi text,
  p_title text,
  p_source text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paper public.papers;
  v_id uuid;
BEGIN
  v_paper := public.own_paper(p_paper_id);
  IF v_paper.status <> 'in_review' THEN
    RAISE EXCEPTION 'Only papers in review are matched against published papers'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT m.id INTO v_id FROM public.doi_matches m
  WHERE m.paper_id = p_paper_id AND m.status = 'pending';
  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- A DOI the researcher said isn't theirs is never proposed again.
  IF EXISTS (
    SELECT 1 FROM public.doi_matches m
    WHERE m.paper_id = p_paper_id AND m.doi = lower(p_doi) AND m.status = 'rejected'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.doi_matches (paper_id, doi, matched_title, source, reason)
  VALUES (p_paper_id, lower(p_doi), p_title, p_source, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The researcher's reply to a match: confirm publishes the paper with that
-- DOI, reject dismisses the match.
CREATE OR REPLACE FUNCTION public.respond_to_doi_match(p_match_id uuid, p_confirm boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.doi_matches;
  v_paper public.papers;
BEGIN
  SELECT * INTO v_match FROM public.doi_matches m WHERE m.id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This match could not be found' USING ERRCODE = 'check_violation';
  END IF;
  v_paper := public.own_paper(v_match.paper_id);
  IF v_match.status <> 'pending' THEN
    RAISE EXCEPTION 'This match has already been answered' USING ERRCODE = 'check_violation';
  END IF;

  IF p_confirm THEN
    IF v_paper.status <> 'in_review' THEN
      RAISE EXCEPTION 'This paper is already published' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.papers p
    SET status = 'published', doi = v_match.doi, auto_matched = false
    WHERE p.id = v_match.paper_id;
    UPDATE public.doi_matches m SET status = 'confirmed' WHERE m.id = p_match_id;
  ELSE
    UPDATE public.doi_matches m SET status = 'rejected' WHERE m.id = p_match_id;
  END IF;
END;
$$;

-- Part of the daily job: matches left unanswered past their deadline
-- publish the paper, marked as matched automatically. Only acts on matches
-- whose deadline has passed, so calling it early does nothing.
CREATE OR REPLACE FUNCTION public.publish_expired_doi_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.doi_matches;
  v_count integer := 0;
BEGIN
  FOR v_match IN
    SELECT m.* FROM public.doi_matches m
    JOIN public.papers p ON p.id = m.paper_id
    WHERE m.status = 'pending' AND m.confirm_by <= now() AND p.status = 'in_review'
    FOR UPDATE OF m
  LOOP
    UPDATE public.papers p
    SET status = 'published', doi = v_match.doi, auto_matched = true
    WHERE p.id = v_match.paper_id;
    UPDATE public.doi_matches m SET status = 'auto_published' WHERE m.id = v_match.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Prototype only: lets the researcher see what happens when nobody replies
-- within 14 days, by moving the deadline of their own pending match to now.
CREATE OR REPLACE FUNCTION public.expire_doi_match_now(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match public.doi_matches;
BEGIN
  SELECT * INTO v_match FROM public.doi_matches m WHERE m.id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This match could not be found' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM public.own_paper(v_match.paper_id);
  UPDATE public.doi_matches m SET confirm_by = now()
  WHERE m.id = p_match_id AND m.status = 'pending';
  PERFORM public.publish_expired_doi_matches();
END;
$$;

-- -----------------------------------------------------------------------------
-- Reads for reviewers and the public. Aggregates only: no individual answers,
-- ever. Both return null when there is nothing to show.
-- -----------------------------------------------------------------------------

-- One study as reviewers and the public see it. Authors are left out here
-- (the paper decides whether to show them), and so is the owner.
-- Runs as the caller: called directly from the API, row-level security
-- limits it to the caller's own papers.
CREATE OR REPLACE FUNCTION public.study_summary(p_version_id uuid, p_poll_id text, p_with_results boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'poll_id', p.id,
    'title', p.title,
    'description', p.description,
    'planned_n', p.planned_n,
    'questions', p.questions,
    'exclusion_rules', p.exclusion_rules,
    'attention_check', (
      SELECT jsonb_build_object('question_id', c.question_id, 'correct_option', c.correct_option)
      FROM public.poll_attention_checks c WHERE c.poll_id = p.id
    ),
    'opened_at', p.opened_at,
    'closed_at', p.closed_at,
    'recorded', (SELECT count(*) FROM public.responses r WHERE r.poll_id = p.id),
    'first_answer_at', (SELECT min(r.created_at) FROM public.responses r WHERE r.poll_id = p.id),
    'last_answer_at', (SELECT max(r.created_at) FROM public.responses r WHERE r.poll_id = p.id),
    'reported', jsonb_build_object(
      'reported_n', s.reported_n,
      'reported_exclusions', s.reported_exclusions,
      'reported_results', s.reported_results
    ),
    'validation', (
      SELECT jsonb_build_object('verdict', v.verdict, 'levels_run', to_jsonb(v.levels_run), 'details', v.details)
      FROM public.validation_results v
      WHERE v.version_id = s.version_id AND v.poll_id = s.poll_id
    ),
    -- Option counts over all recorded answers, only when the researcher
    -- has opted in.
    'results', CASE WHEN p_with_results THEN (
      SELECT jsonb_object_agg(q ->> 'id', (
        SELECT jsonb_object_agg(o, (
          SELECT count(*) FROM public.responses r
          WHERE r.poll_id = p.id AND r.answers ->> (q ->> 'id') = o
        ))
        FROM jsonb_array_elements_text(q -> 'options') o
      ))
      FROM jsonb_array_elements(p.questions) q
    ) END
  )
  FROM public.version_study_numbers s
  JOIN public.polls p ON p.id = s.poll_id
  WHERE s.version_id = p_version_id AND s.poll_id = p_poll_id;
$$;

-- The review page behind an unlisted link: one confirmed round, with the
-- authors replaced by their number.
CREATE OR REPLACE FUNCTION public.get_review_version(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'title', p.title,
    'author_count', jsonb_array_length(p.authors),
    'version', v.version,
    'manuscript_sha256', v.manuscript_sha256,
    'confirmed_at', v.confirmed_at,
    'studies', coalesce((
      SELECT jsonb_agg(public.study_summary(v.id, s.poll_id, false) ORDER BY po.opened_at, po.id)
      FROM public.version_study_numbers s
      JOIN public.polls po ON po.id = s.poll_id
      WHERE s.version_id = v.id
    ), '[]'::jsonb)
  )
  FROM public.paper_versions v
  JOIN public.papers p ON p.id = v.paper_id
  WHERE v.review_token = p_token AND v.confirmed_at IS NOT NULL;
$$;

-- A published paper with its latest confirmed round.
CREATE OR REPLACE FUNCTION public.get_published_paper(p_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'authors', p.authors,
    'doi', p.doi,
    'published_at', p.published_at,
    'auto_matched', p.auto_matched,
    'results_public', p.results_public,
    'version', v.version,
    'manuscript_sha256', v.manuscript_sha256,
    'confirmed_at', v.confirmed_at,
    'studies', coalesce((
      SELECT jsonb_agg(public.study_summary(v.id, s.poll_id, p.results_public) ORDER BY po.opened_at, po.id)
      FROM public.version_study_numbers s
      JOIN public.polls po ON po.id = s.poll_id
      WHERE s.version_id = v.id
    ), '[]'::jsonb)
  )
  FROM public.papers p
  JOIN LATERAL (
    SELECT * FROM public.paper_versions pv
    WHERE pv.paper_id = p.id AND pv.confirmed_at IS NOT NULL
    ORDER BY pv.version DESC LIMIT 1
  ) v ON true
  WHERE p.id = p_id AND p.status = 'published';
$$;

-- Candidates for the public search: published papers matching a DOI, a
-- paper or poll id (from an AllCounted link), or words of the title and
-- authors. Best matches first, at most 5.
CREATE OR REPLACE FUNCTION public.search_published_papers(
  p_dois text[],
  p_ids text[],
  p_terms text[]
)
RETURNS TABLE (
  id text,
  title text,
  authors jsonb,
  doi text,
  published_at timestamptz,
  score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH terms AS (
    SELECT DISTINCT lower(t) AS term
    FROM unnest(coalesce(p_terms, '{}')) t
    WHERE char_length(t) >= 3
    LIMIT 30
  ),
  scored AS (
    SELECT p.id, p.title, p.authors, p.doi, p.published_at,
      CASE
        WHEN p.doi = ANY (SELECT lower(d) FROM unnest(coalesce(p_dois, '{}')) d) THEN 1000
        WHEN p.id = ANY (coalesce(p_ids, '{}'))
          OR EXISTS (
            SELECT 1 FROM public.polls po
            WHERE po.paper_id = p.id AND po.id = ANY (coalesce(p_ids, '{}'))
          ) THEN 1000
        ELSE (
          SELECT count(*)::integer FROM terms
          WHERE position(terms.term IN lower(p.title || ' ' || p.authors::text)) > 0
        )
      END AS score
    FROM public.papers p
    WHERE p.status = 'published'
  )
  SELECT s.id, s.title, s.authors, s.doi, s.published_at, s.score
  FROM scored s
  WHERE s.score >= 1000
    OR (s.score > 0 AND s.score * 2 >= (SELECT count(*) FROM terms))
  ORDER BY s.score DESC, s.published_at DESC
  LIMIT 5;
$$;

-- -----------------------------------------------------------------------------
-- Row-level security: researchers read their own papers and everything
-- belonging to them, and edit only the paper row itself.
-- -----------------------------------------------------------------------------
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_study_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doi_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY papers_select_policy ON public.papers
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

CREATE POLICY papers_insert_policy ON public.papers
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY papers_update_policy ON public.papers
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY papers_delete_policy ON public.papers
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND status = 'draft');

CREATE POLICY paper_versions_select_policy ON public.paper_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = paper_versions.paper_id AND p.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY version_study_numbers_select_policy ON public.version_study_numbers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paper_versions v
      JOIN public.papers p ON p.id = v.paper_id
      WHERE v.id = version_study_numbers.version_id AND p.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY validation_results_select_policy ON public.validation_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paper_versions v
      JOIN public.papers p ON p.id = v.paper_id
      WHERE v.id = validation_results.version_id AND p.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY doi_matches_select_policy ON public.doi_matches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = doi_matches.paper_id AND p.owner_id = (SELECT auth.uid())
    )
  );
