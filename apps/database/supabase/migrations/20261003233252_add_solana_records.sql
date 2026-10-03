create type "public"."record_status" as enum ('pending', 'recorded', 'failed');


  create table "public"."answer_records" (
    "response_id" text not null,
    "poll_id" text not null,
    "seq" integer not null,
    "salt" text,
    "leaf_hash" text not null,
    "tx" text,
    "status" public.record_status not null default 'pending'::public.record_status,
    "recorded_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."answer_records" enable row level security;


  create table "public"."poll_records" (
    "poll_id" text not null,
    "record_pubkey" text not null,
    "record_secret" text not null,
    "plan_hash" text not null,
    "plan_tx" text,
    "status" public.record_status not null default 'pending'::public.record_status,
    "recorded_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."poll_records" enable row level security;

CREATE UNIQUE INDEX answer_records_pkey ON public.answer_records USING btree (response_id);

CREATE UNIQUE INDEX answer_records_poll_id_seq_key ON public.answer_records USING btree (poll_id, seq);

CREATE UNIQUE INDEX poll_records_pkey ON public.poll_records USING btree (poll_id);

CREATE UNIQUE INDEX poll_records_record_pubkey_key ON public.poll_records USING btree (record_pubkey);

alter table "public"."answer_records" add constraint "answer_records_pkey" PRIMARY KEY using index "answer_records_pkey";

alter table "public"."poll_records" add constraint "poll_records_pkey" PRIMARY KEY using index "poll_records_pkey";

alter table "public"."answer_records" add constraint "answer_records_leaf_hash_check" CHECK ((leaf_hash ~ '^[0-9a-f]{64}$'::text)) not valid;

alter table "public"."answer_records" validate constraint "answer_records_leaf_hash_check";

alter table "public"."answer_records" add constraint "answer_records_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."answer_records" validate constraint "answer_records_poll_id_fkey";

alter table "public"."answer_records" add constraint "answer_records_poll_id_seq_key" UNIQUE using index "answer_records_poll_id_seq_key";

alter table "public"."answer_records" add constraint "answer_records_response_id_fkey" FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE not valid;

alter table "public"."answer_records" validate constraint "answer_records_response_id_fkey";

alter table "public"."answer_records" add constraint "answer_records_salt_check" CHECK (((salt IS NULL) OR (salt ~ '^[0-9a-f]{64}$'::text))) not valid;

alter table "public"."answer_records" validate constraint "answer_records_salt_check";

alter table "public"."answer_records" add constraint "answer_records_seq_check" CHECK ((seq > 0)) not valid;

alter table "public"."answer_records" validate constraint "answer_records_seq_check";

alter table "public"."poll_records" add constraint "poll_records_plan_hash_check" CHECK ((plan_hash ~ '^[0-9a-f]{64}$'::text)) not valid;

alter table "public"."poll_records" validate constraint "poll_records_plan_hash_check";

alter table "public"."poll_records" add constraint "poll_records_poll_id_fkey" FOREIGN KEY (poll_id) REFERENCES public.polls(id) ON DELETE CASCADE not valid;

alter table "public"."poll_records" validate constraint "poll_records_poll_id_fkey";

alter table "public"."poll_records" add constraint "poll_records_record_pubkey_key" UNIQUE using index "poll_records_record_pubkey_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_answer_records(p_poll_id text)
 RETURNS TABLE(seq integer, response_id text, leaf_hash text, tx text, status public.record_status, answered_at timestamp with time zone, recorded_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT r.seq, r.id, ar.leaf_hash, ar.tx, coalesce(ar.status, 'pending'), r.created_at, ar.recorded_at
  FROM public.responses r
  JOIN public.polls p ON p.id = r.poll_id
  LEFT JOIN public.answer_records ar ON ar.response_id = r.id
  WHERE r.poll_id = p_poll_id
    AND (p.status <> 'draft' OR p.owner_id = (SELECT auth.uid()))
  ORDER BY r.seq;
$function$
;

CREATE OR REPLACE FUNCTION public.get_poll_record(p_poll_id text)
 RETURNS TABLE(poll_id text, title text, description text, planned_n integer, questions jsonb, exclusion_rules jsonb, status public.poll_status, opened_at timestamp with time zone, closed_at timestamp with time zone, answer_count integer, record_pubkey text, plan_hash text, plan_tx text, plan_status public.record_status, plan_recorded_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id, p.title, p.description, p.planned_n, p.questions, p.exclusion_rules,
         p.status, p.opened_at, p.closed_at,
         (SELECT count(*)::integer FROM public.responses r WHERE r.poll_id = p.id),
         pr.record_pubkey, pr.plan_hash, pr.plan_tx, pr.status, pr.recorded_at
  FROM public.polls p
  LEFT JOIN public.poll_records pr ON pr.poll_id = p.id
  WHERE p.id = p_poll_id
    AND (p.status <> 'draft' OR p.owner_id = (SELECT auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.guard_answer_record_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.response_id <> OLD.response_id
    OR NEW.poll_id <> OLD.poll_id
    OR NEW.seq <> OLD.seq
    OR NEW.leaf_hash <> OLD.leaf_hash
    OR (NEW.salt IS DISTINCT FROM OLD.salt AND NEW.salt IS NOT NULL)
    OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'A fingerprint cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'recorded' AND NEW.tx IS DISTINCT FROM OLD.tx THEN
    RAISE EXCEPTION 'A recorded fingerprint cannot be re-recorded' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_poll_record_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.poll_id <> OLD.poll_id
    OR NEW.record_pubkey <> OLD.record_pubkey
    OR NEW.record_secret <> OLD.record_secret
    OR NEW.plan_hash <> OLD.plan_hash
    OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'A plan fingerprint cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.status = 'recorded' AND NEW.plan_tx IS DISTINCT FROM OLD.plan_tx THEN
    RAISE EXCEPTION 'A recorded plan cannot be re-recorded' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."answer_records" to "anon";

grant insert on table "public"."answer_records" to "anon";

grant references on table "public"."answer_records" to "anon";

grant select on table "public"."answer_records" to "anon";

grant trigger on table "public"."answer_records" to "anon";

grant truncate on table "public"."answer_records" to "anon";

grant update on table "public"."answer_records" to "anon";

grant delete on table "public"."answer_records" to "authenticated";

grant insert on table "public"."answer_records" to "authenticated";

grant references on table "public"."answer_records" to "authenticated";

grant select on table "public"."answer_records" to "authenticated";

grant trigger on table "public"."answer_records" to "authenticated";

grant truncate on table "public"."answer_records" to "authenticated";

grant update on table "public"."answer_records" to "authenticated";

grant delete on table "public"."answer_records" to "service_role";

grant insert on table "public"."answer_records" to "service_role";

grant references on table "public"."answer_records" to "service_role";

grant select on table "public"."answer_records" to "service_role";

grant trigger on table "public"."answer_records" to "service_role";

grant truncate on table "public"."answer_records" to "service_role";

grant update on table "public"."answer_records" to "service_role";

grant delete on table "public"."poll_records" to "anon";

grant insert on table "public"."poll_records" to "anon";

grant references on table "public"."poll_records" to "anon";

grant select on table "public"."poll_records" to "anon";

grant trigger on table "public"."poll_records" to "anon";

grant truncate on table "public"."poll_records" to "anon";

grant update on table "public"."poll_records" to "anon";

grant delete on table "public"."poll_records" to "authenticated";

grant insert on table "public"."poll_records" to "authenticated";

grant references on table "public"."poll_records" to "authenticated";

grant select on table "public"."poll_records" to "authenticated";

grant trigger on table "public"."poll_records" to "authenticated";

grant truncate on table "public"."poll_records" to "authenticated";

grant update on table "public"."poll_records" to "authenticated";

grant delete on table "public"."poll_records" to "service_role";

grant insert on table "public"."poll_records" to "service_role";

grant references on table "public"."poll_records" to "service_role";

grant select on table "public"."poll_records" to "service_role";

grant trigger on table "public"."poll_records" to "service_role";

grant truncate on table "public"."poll_records" to "service_role";

grant update on table "public"."poll_records" to "service_role";


  create policy "answer_records_select_policy"
  on "public"."answer_records"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.polls p
  WHERE ((p.id = answer_records.poll_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));


CREATE TRIGGER guard_answer_record_update BEFORE UPDATE ON public.answer_records FOR EACH ROW EXECUTE FUNCTION public.guard_answer_record_update();

CREATE TRIGGER guard_poll_record_update BEFORE UPDATE ON public.poll_records FOR EACH ROW EXECUTE FUNCTION public.guard_poll_record_update();


