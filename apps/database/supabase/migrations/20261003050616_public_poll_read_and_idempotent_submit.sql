drop policy "polls_select_policy" on "public"."polls";

drop function if exists "public"."submit_response"(p_poll_id text, p_answers jsonb);

alter table "public"."responses" add column "client_id" uuid;

CREATE UNIQUE INDEX responses_poll_id_client_id_key ON public.responses USING btree (poll_id, client_id);

alter table "public"."responses" add constraint "responses_poll_id_client_id_key" UNIQUE using index "responses_poll_id_client_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_public_poll(p_id text)
 RETURNS TABLE(id text, title text, description text, questions jsonb, status public.poll_status)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id, p.title, p.description, p.questions, p.status
  FROM public.polls p
  WHERE p.id = p_id AND p.status IN ('open', 'closed');
$function$
;

CREATE OR REPLACE FUNCTION public.submit_response(p_poll_id text, p_answers jsonb, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id text, seq integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_client_id IS NOT NULL THEN
    RETURN QUERY
      SELECT r.id, r.seq, r.created_at FROM public.responses r
      WHERE r.poll_id = p_poll_id AND r.client_id = p_client_id;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
    INSERT INTO public.responses AS r (poll_id, seq, answers, client_id)
    VALUES (p_poll_id, 1, p_answers, p_client_id)  -- seq is replaced by prepare_response()
    ON CONFLICT (poll_id, client_id) DO NOTHING
    RETURNING r.id, r.seq, r.created_at;
  IF NOT FOUND THEN
    -- A concurrent retry with the same client id saved it first.
    RETURN QUERY
      SELECT r.id, r.seq, r.created_at FROM public.responses r
      WHERE r.poll_id = p_poll_id AND r.client_id = p_client_id;
  END IF;
END;
$function$
;

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
      OR NEW.created_at <> OLD.created_at
      OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
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


  create policy "polls_select_policy"
  on "public"."polls"
  as permissive
  for select
  to authenticated
using ((owner_id = ( SELECT auth.uid() AS uid)));



