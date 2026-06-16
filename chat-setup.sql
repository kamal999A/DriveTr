-- ────────────────────────────────────────────────────────────────────
-- Run this in your Supabase SQL Editor if chat is not working.
-- It ensures the chat_messages table exists with correct FK names
-- and that realtime is enabled for live message delivery.
-- ────────────────────────────────────────────────────────────────────

-- 1. Create table (safe – skipped if already exists)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.car_listings(id)  ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (length(content) > 0),
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index for fast conversation lookups
CREATE INDEX IF NOT EXISTS idx_chat_listing   ON public.chat_messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender    ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver  ON public.chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_created   ON public.chat_messages(created_at);

-- 3. RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist, then recreate
DROP POLICY IF EXISTS "Chat participants can read messages"   ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Receivers can mark read"               ON public.chat_messages;

CREATE POLICY "Chat participants can read messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Authenticated users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark read" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 4. Enable realtime (needed for live chat updates)
-- Run these in the Supabase Dashboard → Database → Replication
-- OR execute here:
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
