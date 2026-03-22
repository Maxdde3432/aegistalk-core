DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_verification_code'
  ) THEN
    ALTER TABLE groups
      ADD CONSTRAINT unique_verification_code UNIQUE (verification_code);
  END IF;
END
$$;
