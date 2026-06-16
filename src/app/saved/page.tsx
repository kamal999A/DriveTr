'use client';
// src/app/saved/page.tsx  ── Saved cars wishlist (V2)

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import CarCard from '@/components/car/CarCard';
import type { CarListing } from '@/types';

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for the auth session to resolve — redirecting while it's still
    // loading kicks logged-in users to /auth/login on every page refresh.
    if (authLoading) return;
    if (!user) { router.push('/auth/login'); return; }
    supabase
      .from('saved_cars')
      .select('listing_id, listing:car_listings(*, seller:profiles(id,name,surname))')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const ls = data
            .map((s: any) => s.listing)
            .filter((l: any) => l && l.status !== 'deleted') as CarListing[];
          setListings(ls);
        }
        setLoading(false);
      });
  }, [user, authLoading]);

  const handleUnsave = (id: string) => {
    setListings(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">
          <Heart size={20} style={{ color: '#ae050a', display: 'inline', marginRight: 8 }} />
          {t.nav.saved}
        </h1>

        {loading ? (
          <div className="grid-listings">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 280, background: '#f0f0f0', borderRadius: 8 }} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <Heart size={48} />
            <h3>No saved cars yet</h3>
            <p>Browse listings and click the heart icon to save cars you like.</p>
            <button className="btn btn-primary" onClick={() => router.push('/cars')}>Browse Cars</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              {listings.length} saved listing{listings.length !== 1 ? 's' : ''}
            </p>
            <div className="grid-listings">
              {listings.map(l => (
                <CarCard
                  key={l.id}
                  listing={l}
                  saved={true}
                  onSaveToggle={(id, s) => { if (!s) handleUnsave(id); }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
