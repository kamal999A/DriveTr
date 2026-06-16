-- ────────────────────────────────────────────────────────────────────
-- Creates the 'reports' and 'contact_messages' tables (missing from the
-- live database — this is why reports and contact messages were never
-- arriving in the Admin panel), adds contact_messages.user_id so admin
-- replies can be routed back to the user as a chat message, and allows
-- chat_messages without a listing (for "DriveTR Support" conversations).
-- Run this in the Supabase SQL Editor.
-- ────────────────────────────────────────────────────────────────────

-- 1. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can report" ON public.reports;
CREATE POLICY "Authenticated users can report" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. CONTACT MESSAGES (with user_id from the start)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case the table already existed without user_id
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Authenticated users can submit contact messages" ON public.contact_messages;
CREATE POLICY "Authenticated users can submit contact messages" ON public.contact_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read contact messages" ON public.contact_messages;
CREATE POLICY "Admins can read contact messages" ON public.contact_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages" ON public.contact_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Allow chat messages without a listing (support conversations)
ALTER TABLE public.chat_messages ALTER COLUMN listing_id DROP NOT NULL;
