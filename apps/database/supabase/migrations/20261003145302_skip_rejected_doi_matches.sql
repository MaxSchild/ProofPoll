set check_function_bodies = off;

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
$function$
;


