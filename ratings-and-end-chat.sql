-- ────────────────────────────────────────────────────────────────────
-- Adds support for "End Chat" + 5-star rating on the DriveTR Support
-- conversation, and an admin-facing ratings list.
-- Run this in the Supabase SQL Editor.
-- ────────────────────────────────────────────────────────────────────

-- 1. RATINGS — submitted by a user after ending their support chat
CREATE TABLE IF NOT EXISTS public.ratings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit their own ratings" ON public.ratings;
CREATE POLICY "Users can submit their own ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read ratings" ON public.ratings;
CREATE POLICY "Admins can read ratings" ON public.ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. SUPPORT CHAT STATUS — tracks whether a user's support thread has
--    been ended (by either the user or an admin), so both sides stop
--    seeing the message input and instead see a "Chat ended" notice.
CREATE TABLE IF NOT EXISTS public.support_chat_status (
  user_id  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ended    BOOLEAN NOT NULL DEFAULT false,
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.support_chat_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own support chat status" ON public.support_chat_status;
CREATE POLICY "Users can view own support chat status" ON public.support_chat_status
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can upsert own support chat status" ON public.support_chat_status;
CREATE POLICY "Users can upsert own support chat status" ON public.support_chat_status
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can update own support chat status" ON public.support_chat_status;
CREATE POLICY "Users can update own support chat status" ON public.support_chat_status
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Enable realtime so both sides see "Chat ended" instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_chat_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_status;
  END IF;
END $$;
