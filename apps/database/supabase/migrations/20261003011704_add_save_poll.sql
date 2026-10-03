set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.save_poll(p_id text, p_poll jsonb, p_check jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_id text;
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO public.polls (title, description, planned_n, questions, exclusion_rules, authors)
    VALUES (
      p_poll ->> 'title',
      coalesce(p_poll ->> 'description', ''),
      (p_poll ->> 'planned_n')::integer,
      p_poll -> 'questions',
      coalesce(p_poll -> 'exclusion_rules', '{}'::jsonb),
      coalesce(p_poll -> 'authors', '[]'::jsonb)
    )
    RETURNING id INTO v_id;
  ELSE
    DELETE FROM public.poll_attention_checks c WHERE c.poll_id = p_id;
    UPDATE public.polls p
    SET title = p_poll ->> 'title',
        description = coalesce(p_poll ->> 'description', ''),
        planned_n = (p_poll ->> 'planned_n')::integer,
        questions = p_poll -> 'questions',
        exclusion_rules = coalesce(p_poll -> 'exclusion_rules', '{}'::jsonb),
        authors = coalesce(p_poll -> 'authors', '[]'::jsonb)
    WHERE p.id = p_id
    RETURNING p.id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'This poll could not be found' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_check IS NOT NULL AND jsonb_typeof(p_check) = 'object' THEN
    INSERT INTO public.poll_attention_checks (poll_id, question_id, correct_option)
    VALUES (v_id, p_check ->> 'question_id', p_check ->> 'correct_option');
  END IF;

  RETURN v_id;
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
    OR NEW.authors IS DISTINCT FROM OLD.authors
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


