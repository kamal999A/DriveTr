-- Soft delete: each participant can independently hide a conversation
-- Run this in Supabase SQL Editor

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_for_sender   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN NOT NULL DEFAULT false;

-- Drop old hard-delete policy
DROP POLICY IF EXISTS "Participants can delete messages" ON public.chat_messages;

-- UPDATE policy: participants can mark their own soft-delete flag
DROP POLICY IF EXISTS "Receivers can mark read" ON public.chat_messages;

CREATE POLICY "Participants can update their own fields" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);
