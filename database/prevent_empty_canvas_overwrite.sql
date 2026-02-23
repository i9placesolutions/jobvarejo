-- Prevent replacing non-empty canvas_data with an empty array.
-- This guards accidental saves that wipe an existing design.

CREATE OR REPLACE FUNCTION public.prevent_empty_canvas_overwrite()
RETURNS trigger AS $$
DECLARE
  old_len integer := 0;
  new_len integer := 0;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(OLD.canvas_data) = 'array' THEN
    old_len := jsonb_array_length(OLD.canvas_data);
  END IF;

  IF jsonb_typeof(NEW.canvas_data) = 'array' THEN
    new_len := jsonb_array_length(NEW.canvas_data);
  END IF;

  IF old_len > 0 AND new_len = 0 THEN
    RAISE EXCEPTION
      USING ERRCODE = '22023',
            MESSAGE = 'Refusing to overwrite non-empty canvas_data with empty content';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_empty_canvas_overwrite ON public.projects;
CREATE TRIGGER trg_prevent_empty_canvas_overwrite
BEFORE UPDATE OF canvas_data ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.prevent_empty_canvas_overwrite();
