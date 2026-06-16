-- ============================================================
-- DriveTR — Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  surname     TEXT NOT NULL DEFAULT '',
  phone       TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_blocked  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────
-- CAR LISTINGS
-- ────────────────────────────────────────────
CREATE TABLE public.car_listings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  make          TEXT NOT NULL,
  model         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  colour        TEXT NOT NULL,
  mileage       INTEGER NOT NULL,
  engine_size   TEXT NOT NULL,
  fuel_type     TEXT NOT NULL CHECK (fuel_type IN ('Petrol','Diesel','Hybrid','Electric','LPG')),
  transmission  TEXT NOT NULL CHECK (transmission IN ('Manual','Automatic','Semi-Automatic')),
  price         NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'TL' CHECK (currency IN ('TL','EUR')),
  description   TEXT,
  city          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','deleted','sold')),
  photos        TEXT[] NOT NULL DEFAULT '{}',
  damage_parts  JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active listings viewable by everyone" ON public.car_listings
  FOR SELECT USING (status != 'deleted');

CREATE POLICY "Users can insert own listings" ON public.car_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listings" ON public.car_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own listings" ON public.car_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_car_listings_updated_at
  BEFORE UPDATE ON public.car_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────
-- SAVED / WISHLIST
-- ────────────────────────────────────────────
CREATE TABLE public.saved_cars (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE public.saved_cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved cars" ON public.saved_cars
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- CHAT MESSAGES
-- ────────────────────────────────────────────
CREATE TABLE public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can read messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Authenticated users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark read" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- ────────────────────────────────────────────
-- REPORTS
-- ────────────────────────────────────────────
CREATE TABLE public.reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can report" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ────────────────────────────────────────────
-- CONTACT MESSAGES
-- ────────────────────────────────────────────
CREATE TABLE public.contact_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact messages" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read contact messages" ON public.contact_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update contact messages" ON public.contact_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ────────────────────────────────────────────
-- ANNOUNCEMENTS
-- ────────────────────────────────────────────
CREATE TABLE public.announcements (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view announcements" ON public.announcements
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage announcements" ON public.announcements
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ────────────────────────────────────────────
-- STORAGE BUCKETS
-- ────────────────────────────────────────────
-- Run these in Supabase Dashboard → Storage
-- 1. Create bucket: "car-photos"  (public: true)
-- 2. Create bucket: "avatars"     (public: true)
