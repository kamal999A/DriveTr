'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from './supabase/client';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const supabase = createClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<void> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
        if (data.is_blocked) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?blocked=1';
          }
          return;
        }
        setProfile(data as Profile);
      }
    } catch {}
  };

  const refreshProfile = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) await fetchProfile(u.id);
  };

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe with
    // the persisted session (no token rotation), then keeps the user/profile
    // in sync on subsequent sign-in/sign-out/token-refresh events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }

        if (u) {
          await fetchProfile(u.id);

          // Listen for an admin blocking this user while they're active —
          // signs them out and redirects immediately on the next change.
          channel = supabase
            .channel(`profile-${u.id}`)
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${u.id}`,
            }, (payload) => {
              if ((payload.new as Profile).is_blocked) {
                fetchProfile(u.id);
              }
            })
            .subscribe();
        } else {
          setProfile(null);
        }
        clearTimeout(timeout);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
      clearTimeout(timeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      isAdmin: profile?.role === 'admin',
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
