create type "public"."poll_status" as enum ('draft', 'open', 'closed');


  create table "public"."poll_attention_checks" (
    "poll_id" text not null,
    "question_id" text not null,
    "correct_option" text not null
      );


alter table "public"."poll_attention_checks" enable row level security;


  create table "public"."polls" (
    "id" text not null default substr(translate(encode(extensions.gen_random_bytes(12), 'base64'::text), '+/='::text, ''::text), 1, 8),
    "owner_id" uuid not null default auth.uid(),
    "title" text not null,
    "description" text not null default ''::text,
    "planned_n" integer,
    "questions" jsonb not null,
    "exclusion_rules" jsonb not null default '{}'::jsonb,
    "authors" jsonb not null default '[]'::jsonb,
    "status" public.poll_status not null default 'draft'::public.poll_status,
    "opened_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."polls" enable row level security;


  create table "public"."responses" (
    "id" text not null default substr(translate(encode(extensions.gen_random_bytes(18), 'base64'::text), '+/='::text, ''::text), 1, 12),
    "poll_id" text not null,
    "seq" integer not null,
    "answers" jsonb not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."responses" enable row level security;

CREATE UNIQUE INDEX poll_attention_checks_pkey ON public.poll_attention_checks USING btree (poll_id);

CREATE INDEX polls_owner_id_created_at_idx ON public.polls USING btree (owner_id, created_at DESC);

CREATE UNIQUE INDEX polls_pkey ON public.polls USING btree (id);

CREATE UNIQUE INDEX responses_pkey ON public.responses USING btree (id);

CREATE UNIQUE INDEX responses_poll_id_seq_key ON public.responses USING btree (poll_id, seq);

alter table "public"."poll_attention_checks" add constraint "poll_attention_checks_pkey" PRIMARY KEY using index "poll_attention_checks_pkey";

alter table "public"."polls" add constraint "polls_pkey" PRIMARY KEY using index "polls_pkey";

alter table "public"."responses" add constraint "responses_pkey" PRIMARY KEY using index "responses_pkey";

alter table "public"."poll_attention_checks" add constraint "poll_attention_checks_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."poll_attention_checks" validate constraint "poll_attention_checks_poll_id_fkey";

alter table "public"."polls" add constraint "polls_authors_check" CHECK (((jsonb_typeof(authors) = 'array'::text) AND (pg_column_size(authors) < 20000))) not valid;

alter table "public"."polls" validate constraint "polls_authors_check";

alter table "public"."polls" add constraint "polls_description_check" CHECK ((char_length(description) <= 5000)) not valid;

alter table "public"."polls" validate constraint "polls_description_check";

alter table "public"."polls" add constraint "polls_exclusion_rules_check" CHECK (((jsonb_typeof(exclusion_rules) = 'object'::text) AND (pg_column_size(exclusion_rules) < 20000))) not valid;

alter table "public"."polls" validate constraint "polls_exclusion_rules_check";

alter table "public"."polls" add constraint "polls_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."polls" validate constraint "polls_owner_id_fkey";

alter table "public"."polls" add constraint "polls_planned_n_check" CHECK (((planned_n IS NULL) OR ((planned_n >= 1) AND (planned_n <= 100000)))) not valid;

alter table "public"."polls" validate constraint "polls_planned_n_check";

alter table "public"."polls" add constraint "polls_questions_check" CHECK (((jsonb_typeof(questions) = 'array'::text) AND ((jsonb_array_length(questions) >= 1) AND (jsonb_array_length(questions) <= 10)))) not valid;

alter table "public"."polls" validate constraint "polls_questions_check";

alter table "public"."polls" add constraint "polls_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 200))) not valid;

alter table "public"."polls" validate constraint "polls_title_check";

alter table "public"."responses" add constraint "responses_answers_check" CHECK ((jsonb_typeof(answers) = 'object'::text)) not valid;

alter table "public"."responses" validate constraint "responses_answers_check";

alter table "public"."responses" add constraint "responses_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."responses" validate constraint "responses_poll_id_fkey";

alter table "public"."responses" add constraint "responses_poll_id_seq_key" UNIQUE using index "responses_poll_id_seq_key";

alter table "public"."responses" add constraint "responses_seq_check" CHECK ((seq > 0)) not valid;

alter table "public"."responses" validate constraint "responses_seq_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.forbid_response_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_poll_attention_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_poll_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.guard_poll_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.validate_poll_questions(NEW.questions);
  NEW.status := 'draft';
  NEW.opened_at := NULL;
  NEW.closed_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_poll_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.poll_response_count(p_poll_id text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT count(*)::integer
  FROM public.responses r
  JOIN public.polls p ON p.id = r.poll_id
  WHERE r.poll_id = p_poll_id
    AND (p.status <> 'draft' OR p.owner_id = (SELECT auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_response(p_poll_id text, p_answers jsonb)
 RETURNS TABLE(id text, seq integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
    INSERT INTO public.responses AS r (poll_id, seq, answers)
    VALUES (p_poll_id, 1, p_answers)  -- seq is replaced by prepare_response()
    RETURNING r.id, r.seq, r.created_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_poll_questions(p_questions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$
;

grant delete on table "public"."poll_attention_checks" to "anon";

grant insert on table "public"."poll_attention_checks" to "anon";

grant references on table "public"."poll_attention_checks" to "anon";

grant select on table "public"."poll_attention_checks" to "anon";

grant trigger on table "public"."poll_attention_checks" to "anon";

grant truncate on table "public"."poll_attention_checks" to "anon";

grant update on table "public"."poll_attention_checks" to "anon";

grant delete on table "public"."poll_attention_checks" to "authenticated";

grant insert on table "public"."poll_attention_checks" to "authenticated";

grant references on table "public"."poll_attention_checks" to "authenticated";

grant select on table "public"."poll_attention_checks" to "authenticated";

grant trigger on table "public"."poll_attention_checks" to "authenticated";

grant truncate on table "public"."poll_attention_checks" to "authenticated";

grant update on table "public"."poll_attention_checks" to "authenticated";

grant delete on table "public"."poll_attention_checks" to "service_role";

grant insert on table "public"."poll_attention_checks" to "service_role";

grant references on table "public"."poll_attention_checks" to "service_role";

grant select on table "public"."poll_attention_checks" to "service_role";

grant trigger on table "public"."poll_attention_checks" to "service_role";

grant truncate on table "public"."poll_attention_checks" to "service_role";

grant update on table "public"."poll_attention_checks" to "service_role";

grant delete on table "public"."polls" to "anon";

grant insert on table "public"."polls" to "anon";

grant references on table "public"."polls" to "anon";

grant select on table "public"."polls" to "anon";

grant trigger on table "public"."polls" to "anon";

grant truncate on table "public"."polls" to "anon";

grant update on table "public"."polls" to "anon";

grant delete on table "public"."polls" to "authenticated";

grant insert on table "public"."polls" to "authenticated";

grant references on table "public"."polls" to "authenticated";

grant select on table "public"."polls" to "authenticated";

grant trigger on table "public"."polls" to "authenticated";

grant truncate on table "public"."polls" to "authenticated";

grant update on table "public"."polls" to "authenticated";

grant delete on table "public"."polls" to "service_role";

grant insert on table "public"."polls" to "service_role";

grant references on table "public"."polls" to "service_role";

grant select on table "public"."polls" to "service_role";

grant trigger on table "public"."polls" to "service_role";

grant truncate on table "public"."polls" to "service_role";

grant update on table "public"."polls" to "service_role";

grant delete on table "public"."responses" to "anon";

grant insert on table "public"."responses" to "anon";

grant references on table "public"."responses" to "anon";

grant select on table "public"."responses" to "anon";

grant trigger on table "public"."responses" to "anon";

grant truncate on table "public"."responses" to "anon";

grant update on table "public"."responses" to "anon";

grant delete on table "public"."responses" to "authenticated";

grant insert on table "public"."responses" to "authenticated";

grant references on table "public"."responses" to "authenticated";

grant select on table "public"."responses" to "authenticated";

grant trigger on table "public"."responses" to "authenticated";

grant truncate on table "public"."responses" to "authenticated";

grant update on table "public"."responses" to "authenticated";

grant delete on table "public"."responses" to "service_role";

grant insert on table "public"."responses" to "service_role";

grant references on table "public"."responses" to "service_role";

grant select on table "public"."responses" to "service_role";

grant trigger on table "public"."responses" to "service_role";

grant truncate on table "public"."responses" to "service_role";

grant update on table "public"."responses" to "service_role";


  create policy "poll_attention_checks_owner_policy"
  on "public"."poll_attention_checks"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.polls p
  WHERE ((p.id = poll_attention_checks.poll_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM public.polls p
  WHERE ((p.id = poll_attention_checks.poll_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));



  create policy "polls_delete_policy"
  on "public"."polls"
  as permissive
  for delete
  to authenticated
using (((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::public.poll_status)));



  create policy "polls_insert_policy"
  on "public"."polls"
  as permissive
  for insert
  to authenticated
with check ((owner_id = ( SELECT auth.uid() AS uid)));



  create policy "polls_select_policy"
  on "public"."polls"
  as permissive
  for select
  to public
using (((status <> 'draft'::public.poll_status) OR (owner_id = ( SELECT auth.uid() AS uid))));



  create policy "polls_update_policy"
  on "public"."polls"
  as permissive
  for update
  to authenticated
using ((owner_id = ( SELECT auth.uid() AS uid)))
with check ((owner_id = ( SELECT auth.uid() AS uid)));



  create policy "responses_select_policy"
  on "public"."responses"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.polls p
  WHERE ((p.id = responses.poll_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));


CREATE TRIGGER guard_poll_attention_check BEFORE INSERT OR DELETE OR UPDATE ON public.poll_attention_checks FOR EACH ROW EXECUTE FUNCTION public.guard_poll_attention_check();

CREATE TRIGGER guard_poll_delete BEFORE DELETE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.guard_poll_delete();

CREATE TRIGGER guard_poll_insert BEFORE INSERT ON public.polls FOR EACH ROW EXECUTE FUNCTION public.guard_poll_insert();

CREATE TRIGGER guard_poll_truncate BEFORE TRUNCATE ON public.polls FOR EACH STATEMENT EXECUTE FUNCTION public.guard_poll_delete();

CREATE TRIGGER guard_poll_update BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.guard_poll_update();

CREATE TRIGGER forbid_response_truncate BEFORE TRUNCATE ON public.responses FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_response_changes();

CREATE TRIGGER forbid_response_update_delete BEFORE DELETE OR UPDATE ON public.responses FOR EACH ROW EXECUTE FUNCTION public.forbid_response_changes();

CREATE TRIGGER prepare_response BEFORE INSERT ON public.responses FOR EACH ROW EXECUTE FUNCTION public.prepare_response();


