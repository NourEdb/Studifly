-- Drop the CHECK constraint on tasks.activity_type so any custom string is accepted.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'tasks'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%activity_type IN%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE tasks DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END $$;
