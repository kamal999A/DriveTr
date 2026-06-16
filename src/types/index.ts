// src/types/index.ts

export type Role = 'user' | 'admin';
export type Language = 'en' | 'tr';
export type Currency = 'TL' | 'EUR';
export type FuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric' | 'LPG';
export type Transmission = 'Manual' | 'Automatic' | 'Semi-Automatic';
export type ListingStatus = 'active' | 'inactive' | 'deleted' | 'sold';

export interface Profile {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  is_blocked: boolean;
  created_at: string;
}

export interface CarListing {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  colour: string;
  mileage: number;
  engine_size: string;
  fuel_type: FuelType;
  transmission: Transmission;
  price: number;
  currency: Currency;
  description: string | null;
  city: string;
  status: ListingStatus;
  photos: string[];
  damage_parts: DamagedPart[];
  created_at: string;
  updated_at: string;
  seller?: Profile;
}

export interface DamagedPart {
  id: string;
  label: string;
  x: number; // percentage position on SVG
  y: number;
}

export interface SavedCar {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
  listing?: CarListing;
}

export interface ChatMessage {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender?: Profile;
}

export interface Report {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
  listing?: CarListing;
}

export interface ContactMessage {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface CarFilters {
  make?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  colour?: string;
  engine_size?: string;
  fuel_type?: FuelType;
  transmission?: Transmission;
  price_min?: number;
  price_max?: number;
  mileage_max?: number;
  currency?: Currency;
}
