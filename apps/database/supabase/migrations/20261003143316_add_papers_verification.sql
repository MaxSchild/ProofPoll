create type "public"."paper_status" as enum ('draft', 'in_review', 'published');


  create table "public"."doi_matches" (
    "id" uuid not null default gen_random_uuid(),
    "paper_id" text not null,
    "doi" text not null,
    "matched_title" text not null,
    "source" text not null,
    "reason" text not null,
    "matched_at" timestamp with time zone not null default now(),
    "confirm_by" timestamp with time zone not null default (now() + '14 days'::interval),
    "status" text not null default 'pending'::text
      );


alter table "public"."doi_matches" enable row level security;


  create table "public"."paper_versions" (
    "id" uuid not null default gen_random_uuid(),
    "paper_id" text not null,
    "version" integer not null,
    "review_token" text not null default substr(translate(encode(extensions.gen_random_bytes(30), 'base64'::text), '+/='::text, ''::text), 1, 24),
    "manuscript_sha256" text not null,
    "manuscript_name" text not null,
    "created_at" timestamp with time zone not null default now(),
    "confirmed_at" timestamp with time zone
      );


alter table "public"."paper_versions" enable row level security;


  create table "public"."papers" (
    "id" text not null default substr(translate(encode(extensions.gen_random_bytes(12), 'base64'::text), '+/='::text, ''::text), 1, 8),
    "owner_id" uuid not null default auth.uid(),
    "title" text not null,
    "authors" jsonb not null default '[]'::jsonb,
    "status" public.paper_status not null default 'draft'::public.paper_status,
    "doi" text,
    "published_at" timestamp with time zone,
    "auto_matched" boolean not null default false,
    "results_public" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."papers" enable row level security;


  create table "public"."validation_results" (
    "version_id" uuid not null,
    "poll_id" text not null,
    "verdict" text not null,
    "levels_run" text[] not null,
    "details" jsonb not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."validation_results" enable row level security;


  create table "public"."version_study_numbers" (
    "version_id" uuid not null,
    "poll_id" text not null,
    "extracted" jsonb not null default '{}'::jsonb,
    "reported_n" integer,
    "reported_exclusions" integer,
    "reported_results" jsonb not null default '{}'::jsonb
      );


alter table "public"."version_study_numbers" enable row level security;

alter table "public"."polls" add column "paper_id" text;

CREATE UNIQUE INDEX doi_matches_one_pending_idx ON public.doi_matches USING btree (paper_id) WHERE (status = 'pending'::text);

CREATE INDEX doi_matches_paper_id_idx ON public.doi_matches USING btree (paper_id);

CREATE UNIQUE INDEX doi_matches_pkey ON public.doi_matches USING btree (id);

CREATE UNIQUE INDEX paper_versions_paper_id_version_key ON public.paper_versions USING btree (paper_id, version);

CREATE UNIQUE INDEX paper_versions_pkey ON public.paper_versions USING btree (id);

CREATE UNIQUE INDEX paper_versions_review_token_key ON public.paper_versions USING btree (review_token);

CREATE INDEX papers_owner_id_created_at_idx ON public.papers USING btree (owner_id, created_at DESC);

CREATE UNIQUE INDEX papers_pkey ON public.papers USING btree (id);

CREATE INDEX polls_paper_id_idx ON public.polls USING btree (paper_id);

CREATE UNIQUE INDEX validation_results_pkey ON public.validation_results USING btree (version_id, poll_id);

CREATE UNIQUE INDEX version_study_numbers_pkey ON public.version_study_numbers USING btree (version_id, poll_id);

alter table "public"."doi_matches" add constraint "doi_matches_pkey" PRIMARY KEY using index "doi_matches_pkey";

alter table "public"."paper_versions" add constraint "paper_versions_pkey" PRIMARY KEY using index "paper_versions_pkey";

alter table "public"."papers" add constraint "papers_pkey" PRIMARY KEY using index "papers_pkey";

alter table "public"."validation_results" add constraint "validation_results_pkey" PRIMARY KEY using index "validation_results_pkey";

alter table "public"."version_study_numbers" add constraint "version_study_numbers_pkey" PRIMARY KEY using index "version_study_numbers_pkey";

alter table "public"."doi_matches" add constraint "doi_matches_doi_check" CHECK ((doi ~ '^10\.[0-9]{4,9}/\S{1,200}$'::text)) not valid;

alter table "public"."doi_matches" validate constraint "doi_matches_doi_check";

alter table "public"."doi_matches" add constraint "doi_matches_paper_id_fkey" FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE not valid;

alter table "public"."doi_matches" validate constraint "doi_matches_paper_id_fkey";

alter table "public"."doi_matches" add constraint "doi_matches_reason_check" CHECK ((reason = ANY (ARRAY['cites_link'::text, 'title_authors'::text]))) not valid;

alter table "public"."doi_matches" validate constraint "doi_matches_reason_check";

alter table "public"."doi_matches" add constraint "doi_matches_source_check" CHECK ((source = ANY (ARRAY['crossref'::text, 'openalex'::text]))) not valid;

alter table "public"."doi_matches" validate constraint "doi_matches_source_check";

alter table "public"."doi_matches" add constraint "doi_matches_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'auto_published'::text]))) not valid;

alter table "public"."doi_matches" validate constraint "doi_matches_status_check";

alter table "public"."paper_versions" add constraint "paper_versions_manuscript_name_check" CHECK (((char_length(manuscript_name) >= 1) AND (char_length(manuscript_name) <= 255))) not valid;

alter table "public"."paper_versions" validate constraint "paper_versions_manuscript_name_check";

alter table "public"."paper_versions" add constraint "paper_versions_manuscript_sha256_check" CHECK ((manuscript_sha256 ~ '^[0-9a-f]{64}$'::text)) not valid;

alter table "public"."paper_versions" validate constraint "paper_versions_manuscript_sha256_check";

alter table "public"."paper_versions" add constraint "paper_versions_paper_id_fkey" FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE not valid;

alter table "public"."paper_versions" validate constraint "paper_versions_paper_id_fkey";

alter table "public"."paper_versions" add constraint "paper_versions_paper_id_version_key" UNIQUE using index "paper_versions_paper_id_version_key";

alter table "public"."paper_versions" add constraint "paper_versions_review_token_key" UNIQUE using index "paper_versions_review_token_key";

alter table "public"."paper_versions" add constraint "paper_versions_version_check" CHECK ((version > 0)) not valid;

alter table "public"."paper_versions" validate constraint "paper_versions_version_check";

alter table "public"."papers" add constraint "papers_authors_check" CHECK (((jsonb_typeof(authors) = 'array'::text) AND (pg_column_size(authors) < 20000))) not valid;

alter table "public"."papers" validate constraint "papers_authors_check";

alter table "public"."papers" add constraint "papers_doi_check" CHECK (((doi IS NULL) OR (doi ~ '^10\.[0-9]{4,9}/\S{1,200}$'::text))) not valid;

alter table "public"."papers" validate constraint "papers_doi_check";

alter table "public"."papers" add constraint "papers_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."papers" validate constraint "papers_owner_id_fkey";

alter table "public"."papers" add constraint "papers_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 300))) not valid;

alter table "public"."papers" validate constraint "papers_title_check";

alter table "public"."polls" add constraint "polls_paper_id_fkey" FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE SET NULL not valid;

alter table "public"."polls" validate constraint "polls_paper_id_fkey";

alter table "public"."validation_results" add constraint "validation_results_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."validation_results" validate constraint "validation_results_poll_id_fkey";

alter table "public"."validation_results" add constraint "validation_results_verdict_check" CHECK ((verdict = ANY (ARRAY['consistent'::text, 'inconsistent'::text, 'not_checkable'::text]))) not valid;

alter table "public"."validation_results" validate constraint "validation_results_verdict_check";

alter table "public"."validation_results" add constraint "validation_results_version_id_fkey" FOREIGN KEY (version_id) REFERENCES public.paper_versions(id) ON DELETE CASCADE not valid;

alter table "public"."validation_results" validate constraint "validation_results_version_id_fkey";

alter table "public"."version_study_numbers" add constraint "version_study_numbers_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."version_study_numbers" validate constraint "version_study_numbers_poll_id_fkey";

alter table "public"."version_study_numbers" add constraint "version_study_numbers_reported_exclusions_check" CHECK (((reported_exclusions IS NULL) OR (reported_exclusions >= 0))) not valid;

alter table "public"."version_study_numbers" validate constraint "version_study_numbers_reported_exclusions_check";

alter table "public"."version_study_numbers" add constraint "version_study_numbers_reported_n_check" CHECK (((reported_n IS NULL) OR (reported_n >= 0))) not valid;

alter table "public"."version_study_numbers" validate constraint "version_study_numbers_reported_n_check";

alter table "public"."version_study_numbers" add constraint "version_study_numbers_reported_results_check" CHECK ((jsonb_typeof(reported_results) = 'object'::text)) not valid;

alter table "public"."version_study_numbers" validate constraint "version_study_numbers_reported_results_check";

alter table "public"."version_study_numbers" add constraint "version_study_numbers_version_id_fkey" FOREIGN KEY (version_id) REFERENCES public.paper_versions(id) ON DELETE CASCADE not valid;

alter table "public"."version_study_numbers" validate constraint "version_study_numbers_version_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.confirm_paper_version(p_version_id uuid, p_numbers jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_paper_version(p_paper_id text, p_sha256 text, p_name text, p_extracted jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.discard_paper_version(p_version_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.expire_doi_match_now(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_published_paper(p_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_review_version(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_confirmed_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_paper_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_paper_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.status := 'draft';
  NEW.doi := NULL;
  NEW.published_at := NULL;
  NEW.auto_matched := false;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_paper_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_poll_paper()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_api_request()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT current_user IN ('anon', 'authenticated');
$function$
;

CREATE OR REPLACE FUNCTION public.own_paper(p_paper_id text)
 RETURNS public.papers
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.publish_expired_doi_matches()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.record_doi_match(p_paper_id text, p_doi text, p_title text, p_source text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  INSERT INTO public.doi_matches (paper_id, doi, matched_title, source, reason)
  VALUES (p_paper_id, lower(p_doi), p_title, p_source, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.respond_to_doi_match(p_match_id uuid, p_confirm boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.save_paper(p_id text, p_paper jsonb, p_poll_ids text[])
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_published_papers(p_dois text[], p_ids text[], p_terms text[])
 RETURNS TABLE(id text, title text, authors jsonb, doi text, published_at timestamp with time zone, score integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.study_summary(p_version_id uuid, p_poll_id text, p_with_results boolean)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_study(p_poll_id text, p_reported_n integer, p_reported_exclusions integer, p_reported_results jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;

grant delete on table "public"."doi_matches" to "anon";

grant insert on table "public"."doi_matches" to "anon";

grant references on table "public"."doi_matches" to "anon";

grant select on table "public"."doi_matches" to "anon";

grant trigger on table "public"."doi_matches" to "anon";

grant truncate on table "public"."doi_matches" to "anon";

grant update on table "public"."doi_matches" to "anon";

grant delete on table "public"."doi_matches" to "authenticated";

grant insert on table "public"."doi_matches" to "authenticated";

grant references on table "public"."doi_matches" to "authenticated";

grant select on table "public"."doi_matches" to "authenticated";

grant trigger on table "public"."doi_matches" to "authenticated";

grant truncate on table "public"."doi_matches" to "authenticated";

grant update on table "public"."doi_matches" to "authenticated";

grant delete on table "public"."doi_matches" to "service_role";

grant insert on table "public"."doi_matches" to "service_role";

grant references on table "public"."doi_matches" to "service_role";

grant select on table "public"."doi_matches" to "service_role";

grant trigger on table "public"."doi_matches" to "service_role";

grant truncate on table "public"."doi_matches" to "service_role";

grant update on table "public"."doi_matches" to "service_role";

grant delete on table "public"."paper_versions" to "anon";

grant insert on table "public"."paper_versions" to "anon";

grant references on table "public"."paper_versions" to "anon";

grant select on table "public"."paper_versions" to "anon";

grant trigger on table "public"."paper_versions" to "anon";

grant truncate on table "public"."paper_versions" to "anon";

grant update on table "public"."paper_versions" to "anon";

grant delete on table "public"."paper_versions" to "authenticated";

grant insert on table "public"."paper_versions" to "authenticated";

grant references on table "public"."paper_versions" to "authenticated";

grant select on table "public"."paper_versions" to "authenticated";

grant trigger on table "public"."paper_versions" to "authenticated";

grant truncate on table "public"."paper_versions" to "authenticated";

grant update on table "public"."paper_versions" to "authenticated";

grant delete on table "public"."paper_versions" to "service_role";

grant insert on table "public"."paper_versions" to "service_role";

grant references on table "public"."paper_versions" to "service_role";

grant select on table "public"."paper_versions" to "service_role";

grant trigger on table "public"."paper_versions" to "service_role";

grant truncate on table "public"."paper_versions" to "service_role";

grant update on table "public"."paper_versions" to "service_role";

grant delete on table "public"."papers" to "anon";

grant insert on table "public"."papers" to "anon";

grant references on table "public"."papers" to "anon";

grant select on table "public"."papers" to "anon";

grant trigger on table "public"."papers" to "anon";

grant truncate on table "public"."papers" to "anon";

grant update on table "public"."papers" to "anon";

grant delete on table "public"."papers" to "authenticated";

grant insert on table "public"."papers" to "authenticated";

grant references on table "public"."papers" to "authenticated";

grant select on table "public"."papers" to "authenticated";

grant trigger on table "public"."papers" to "authenticated";

grant truncate on table "public"."papers" to "authenticated";

grant update on table "public"."papers" to "authenticated";

grant delete on table "public"."papers" to "service_role";

grant insert on table "public"."papers" to "service_role";

grant references on table "public"."papers" to "service_role";

grant select on table "public"."papers" to "service_role";

grant trigger on table "public"."papers" to "service_role";

grant truncate on table "public"."papers" to "service_role";

grant update on table "public"."papers" to "service_role";

grant delete on table "public"."validation_results" to "anon";

grant insert on table "public"."validation_results" to "anon";

grant references on table "public"."validation_results" to "anon";

grant select on table "public"."validation_results" to "anon";

grant trigger on table "public"."validation_results" to "anon";

grant truncate on table "public"."validation_results" to "anon";

grant update on table "public"."validation_results" to "anon";

grant delete on table "public"."validation_results" to "authenticated";

grant insert on table "public"."validation_results" to "authenticated";

grant references on table "public"."validation_results" to "authenticated";

grant select on table "public"."validation_results" to "authenticated";

grant trigger on table "public"."validation_results" to "authenticated";

grant truncate on table "public"."validation_results" to "authenticated";

grant update on table "public"."validation_results" to "authenticated";

grant delete on table "public"."validation_results" to "service_role";

grant insert on table "public"."validation_results" to "service_role";

grant references on table "public"."validation_results" to "service_role";

grant select on table "public"."validation_results" to "service_role";

grant trigger on table "public"."validation_results" to "service_role";

grant truncate on table "public"."validation_results" to "service_role";

grant update on table "public"."validation_results" to "service_role";

grant delete on table "public"."version_study_numbers" to "anon";

grant insert on table "public"."version_study_numbers" to "anon";

grant references on table "public"."version_study_numbers" to "anon";

grant select on table "public"."version_study_numbers" to "anon";

grant trigger on table "public"."version_study_numbers" to "anon";

grant truncate on table "public"."version_study_numbers" to "anon";

grant update on table "public"."version_study_numbers" to "anon";

grant delete on table "public"."version_study_numbers" to "authenticated";

grant insert on table "public"."version_study_numbers" to "authenticated";

grant references on table "public"."version_study_numbers" to "authenticated";

grant select on table "public"."version_study_numbers" to "authenticated";

grant trigger on table "public"."version_study_numbers" to "authenticated";

grant truncate on table "public"."version_study_numbers" to "authenticated";

grant update on table "public"."version_study_numbers" to "authenticated";

grant delete on table "public"."version_study_numbers" to "service_role";

grant insert on table "public"."version_study_numbers" to "service_role";

grant references on table "public"."version_study_numbers" to "service_role";

grant select on table "public"."version_study_numbers" to "service_role";

grant trigger on table "public"."version_study_numbers" to "service_role";

grant truncate on table "public"."version_study_numbers" to "service_role";

grant update on table "public"."version_study_numbers" to "service_role";


  create policy "doi_matches_select_policy"
  on "public"."doi_matches"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.papers p
  WHERE ((p.id = doi_matches.paper_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));



  create policy "paper_versions_select_policy"
  on "public"."paper_versions"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.papers p
  WHERE ((p.id = paper_versions.paper_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));



  create policy "papers_delete_policy"
  on "public"."papers"
  as permissive
  for delete
  to authenticated
using (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::public.paper_status)));



  create policy "papers_insert_policy"
  on "public"."papers"
  as permissive
  for insert
  to authenticated
with check ((owner_id = ( SELECT auth.uid() AS uid)));



  create policy "papers_select_policy"
  on "public"."papers"
  as permissive
  for select
  to authenticated
using ((owner_id = ( SELECT auth.uid() AS uid)));



  create policy "papers_update_policy"
  on "public"."papers"
  as permissive
  for update
  to authenticated
using ((owner_id = ( SELECT auth.uid() AS uid)))
with check ((owner_id = ( SELECT auth.uid() AS uid)));



  create policy "validation_results_select_policy"
  on "public"."validation_results"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.paper_versions v
     JOIN public.papers p ON ((p.id = v.paper_id)))
  WHERE ((v.id = validation_results.version_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));



  create policy "version_study_numbers_select_policy"
  on "public"."version_study_numbers"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.paper_versions v
     JOIN public.papers p ON ((p.id = v.paper_id)))
  WHERE ((v.id = version_study_numbers.version_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));


CREATE TRIGGER guard_confirmed_version BEFORE DELETE OR UPDATE ON public.paper_versions FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_version_truncate BEFORE TRUNCATE ON public.paper_versions FOR EACH STATEMENT EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_paper_delete BEFORE DELETE ON public.papers FOR EACH ROW EXECUTE FUNCTION public.guard_paper_delete();

CREATE TRIGGER guard_paper_insert BEFORE INSERT ON public.papers FOR EACH ROW EXECUTE FUNCTION public.guard_paper_insert();

CREATE TRIGGER guard_paper_truncate BEFORE TRUNCATE ON public.papers FOR EACH STATEMENT EXECUTE FUNCTION public.guard_paper_delete();

CREATE TRIGGER guard_paper_update BEFORE UPDATE ON public.papers FOR EACH ROW EXECUTE FUNCTION public.guard_paper_update();

CREATE TRIGGER guard_poll_paper BEFORE INSERT OR UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.guard_poll_paper();

CREATE TRIGGER guard_confirmed_validation BEFORE DELETE OR UPDATE ON public.validation_results FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_validation_truncate BEFORE TRUNCATE ON public.validation_results FOR EACH STATEMENT EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_numbers BEFORE DELETE OR UPDATE ON public.version_study_numbers FOR EACH ROW EXECUTE FUNCTION public.guard_confirmed_version();

CREATE TRIGGER guard_confirmed_numbers_truncate BEFORE TRUNCATE ON public.version_study_numbers FOR EACH STATEMENT EXECUTE FUNCTION public.guard_confirmed_version();


