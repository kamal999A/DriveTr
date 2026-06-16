-- Run this ENTIRE block in Supabase SQL Editor → paste → Run
-- It is safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS)

-- 1. Make sure uuid extension is on
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create chat_messages if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID        NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (length(trim(content)) > 0),
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_chat_listing  ON public.chat_messages(listing_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender   ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON public.chat_messages(receiver_id);

-- 4. Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Drop and recreate policies cleanly
DROP POLICY IF EXISTS "Chat participants can read messages"    ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send messages"  ON public.chat_messages;
DROP POLICY IF EXISTS "Receivers can mark read"               ON public.chat_messages;

-- Allow participants to read their own messages
CREATE POLICY "Chat participants can read messages" ON public.chat_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Allow any authenticated user to send (insert) where they are the sender
CREATE POLICY "Authenticated users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid() = sender_id
  );

-- Allow receiver to mark as read
CREATE POLICY "Receivers can mark read" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 6. Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Verify: should return the table
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages';
