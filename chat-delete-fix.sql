-- Run this in Supabase SQL Editor to fix chat deletion
-- Adds a DELETE policy so both sender and receiver can delete messages

DROP POLICY IF EXISTS "Participants can delete messages" ON public.chat_messages;

CREATE POLICY "Participants can delete messages" ON public.chat_messages
  FOR DELETE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );
