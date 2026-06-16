-- 1. Allow admins to update any user's profile (needed for the
--    block/unblock toggle in the admin panel — the existing
--    "Users can update own profile" policy only lets a user edit
--    their own row, so an admin's UPDATE on is_blocked was silently
--    rejected by RLS and never persisted).
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Enable realtime updates for the profiles table so that when an admin
--    blocks/unblocks a user, the change is pushed to that user's active
--    session immediately (used by src/lib/auth-context.tsx).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Verify: should return the table
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles';
