-- Drop the CHECK constraint on events.type that limited it to a fixed set of values.
-- The constraint was created inline so its name is auto-generated; find and drop it dynamically.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type IN%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE events DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END $$;
