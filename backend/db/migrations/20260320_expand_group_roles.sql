DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'group_members'
      AND constraint_name = 'group_members_role_check'
  ) THEN
    ALTER TABLE group_members DROP CONSTRAINT group_members_role_check;
  END IF;
END $$;

ALTER TABLE group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'bot'));
