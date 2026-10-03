-- =============================================================================
-- Records on Solana (devnet)
--
-- When a poll opens, a fingerprint of its plan is written to Solana; every
-- answer gets its own fingerprint record after it is saved. Each poll has its
-- own keypair (the "record key") that co-signs all of its records, so the
-- explorer page of that address lists the poll's whole record.
--
-- Both tables are written only by the app server with the service role (row-
-- level security on, no write policies). Owners can read their polls' records;
-- everyone else goes through get_poll_record() and get_answer_records(), which
-- never return the record key's secret or the answers' salts.
-- =============================================================================

CREATE TYPE public.record_status AS ENUM ('pending', 'recorded', 'failed');

CREATE TABLE IF NOT EXISTS public.poll_records (
  poll_id text PRIMARY KEY REFERENCES public.polls (id) ON DELETE CASCADE,
  record_pubkey text NOT NULL UNIQUE,
  -- Prototype only: the record key's secret in plain text (spec §10).
  record_secret text NOT NULL,
  plan_hash text NOT NULL CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  plan_tx text,
  status public.record_status NOT NULL DEFAULT 'pending',
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.answer_records (
  response_id text PRIMARY KEY REFERENCES public.responses (id) ON DELETE CASCADE,
  poll_id text NOT NULL REFERENCES public.polls (id) ON DELETE CASCADE,
  seq integer NOT NULL CHECK (seq > 0),
  -- 32 random bytes as hex. Deleting it makes the fingerprint unmatchable
  -- while the record still counts (spec §10).
  salt text CHECK (salt IS NULL OR salt ~ '^[0-9a-f]{64}$'),
  leaf_hash text NOT NULL CHECK (leaf_hash ~ '^[0-9a-f]{64}$'),
  tx text,
  status public.record_status NOT NULL DEFAULT 'pending',
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT answer_records_poll_id_seq_key UNIQUE (poll_id, seq)
);

-- A fingerprint, once made, is fixed: only the transaction, status and time
-- can be filled in, and the salt can only be erased.
CREATE OR REPLACE FUNCTION public.guard_answer_record_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

CREATE TRIGGER guard_answer_record_update
  BEFORE UPDATE ON public.answer_records
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_answer_record_update();

CREATE OR REPLACE FUNCTION public.guard_poll_record_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

CREATE TRIGGER guard_poll_record_update
  BEFORE UPDATE ON public.poll_records
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_poll_record_update();

ALTER TABLE public.poll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_records ENABLE ROW LEVEL SECURITY;

-- No policy on poll_records: it holds the record key's secret, so only the
-- service role reads it. Owners read it through get_poll_record() like
-- everyone else.

CREATE POLICY answer_records_select_policy ON public.answer_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = answer_records.poll_id AND p.owner_id = (SELECT auth.uid())
    )
  );

-- The public part of a poll's record, for an open or closed poll (or one's
-- own draft, which has none yet). The plan is returned so anyone can
-- recompute its fingerprint.
CREATE OR REPLACE FUNCTION public.get_poll_record(p_poll_id text)
RETURNS TABLE (
  poll_id text,
  title text,
  description text,
  planned_n integer,
  questions jsonb,
  exclusion_rules jsonb,
  status public.poll_status,
  opened_at timestamptz,
  closed_at timestamptz,
  answer_count integer,
  record_pubkey text,
  plan_hash text,
  plan_tx text,
  plan_status public.record_status,
  plan_recorded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.title, p.description, p.planned_n, p.questions, p.exclusion_rules,
         p.status, p.opened_at, p.closed_at,
         (SELECT count(*)::integer FROM public.responses r WHERE r.poll_id = p.id),
         pr.record_pubkey, pr.plan_hash, pr.plan_tx, pr.status, pr.recorded_at
  FROM public.polls p
  LEFT JOIN public.poll_records pr ON pr.poll_id = p.id
  WHERE p.id = p_poll_id
    AND (p.status <> 'draft' OR p.owner_id = (SELECT auth.uid()));
$$;

-- Every answer's fingerprint and transaction, in arrival order, without the
-- answers or their salts.
CREATE OR REPLACE FUNCTION public.get_answer_records(p_poll_id text)
RETURNS TABLE (
  seq integer,
  response_id text,
  leaf_hash text,
  tx text,
  status public.record_status,
  answered_at timestamptz,
  recorded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.seq, r.id, ar.leaf_hash, ar.tx, coalesce(ar.status, 'pending'), r.created_at, ar.recorded_at
  FROM public.responses r
  JOIN public.polls p ON p.id = r.poll_id
  LEFT JOIN public.answer_records ar ON ar.response_id = r.id
  WHERE r.poll_id = p_poll_id
    AND (p.status <> 'draft' OR p.owner_id = (SELECT auth.uid()))
  ORDER BY r.seq;
$$;
