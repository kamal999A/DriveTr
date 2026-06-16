-- Allow admins to update and delete ANY listing (status toggle, edit,
-- and delete from the admin panel). The original policies only let a
-- user modify their own listings ("auth.uid() = user_id"), so admin
-- actions on other users' listings were silently rejected by RLS.

DROP POLICY IF EXISTS "Admins can update any listing" ON public.car_listings;
CREATE POLICY "Admins can update any listing" ON public.car_listings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete any listing" ON public.car_listings;
CREATE POLICY "Admins can delete any listing" ON public.car_listings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
