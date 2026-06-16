-- Allow anyone (including signed-out visitors) to submit a contact message.
-- Logged-in users still get user_id set to their own id; guests get user_id = NULL.
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Authenticated users can submit contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages" ON public.contact_messages
  FOR INSERT WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );
