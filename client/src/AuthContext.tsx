import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rsmuxpoaabdzgfyjmvwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbXV4cG9hYWJkemdmeWptdndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjc4MTMsImV4cCI6MjA3MjY0MzgxM30.cPVVRISCpGl4YpmZ75wK5MoPaOKIYky2popSk_v1XPE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface UserProfile {
  id: string;
  username: string | null;
  user_number: number;
  owned: string[];
  favourites: string[];
  wishlist: string[];
  verified_cards: string[];
  bio: string | null;
  island_name: string | null;
  avg_rating: number | null;
  rating_count: number;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (identifier: string, secret: string) => Promise<string | null>;
  logout: () => void;
  updateOwned: (owned: string[]) => Promise<void>;
  toggleFavourite: (villager: string) => Promise<void>;
  toggleWishlist: (villager: string) => Promise<void>;
  toggleOwned: (villager: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('ac_user');
    if (stored) {
      try { 
        const parsed = JSON.parse(stored);
        // Ensure verified_cards exists for older stored profiles
        if (parsed && !parsed.verified_cards) {
          parsed.verified_cards = [];
        }
        setUser(parsed); 
      } catch {}
    }
    setLoading(false);
  }, []);

  // Global heartbeat to update online status
  useEffect(() => {
    if (!user) return;

    // Update immediately when user comes online
    supabase.from('ac_users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);

    // Then update every 2 minutes to stay online
    const heartbeat = setInterval(() => {
      supabase.from('ac_users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    }, 2 * 60 * 1000);

    return () => clearInterval(heartbeat);
  }, [user]);

  const login = async (identifier: string, secret: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('ac_users')
      .select('*')
      .or(`username.eq.${identifier},user_number.eq.${parseInt(identifier) || -1}`)
      .single();

    if (error || !data) return 'User not found';

    const hash = await hashSecret(secret);
    if (data.secret_hash !== hash) return 'Incorrect password or PIN';

    const profile: UserProfile = {
      id: data.id,
      username: data.username,
      user_number: data.user_number,
      owned: data.owned || [],
      favourites: data.favourites || [],
      wishlist: data.wishlist || [],
      verified_cards: data.verified_cards || [],
      bio: data.bio || null,
      island_name: data.island_name || null,
      avg_rating: data.avg_rating || null,
      rating_count: data.rating_count || 0,
    };
    setUser(profile);
    localStorage.setItem('ac_user', JSON.stringify(profile));
    return null;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ac_user');
  };

  const updateOwned = async (owned: string[]) => {
    if (!user) return;
    await supabase.from('ac_users').update({ owned }).eq('id', user.id);
    const updated = { ...user, owned };
    setUser(updated);
    localStorage.setItem('ac_user', JSON.stringify(updated));
  };

  const toggleFavourite = async (villager: string) => {
    if (!user) return;
    const favs = user.favourites.includes(villager)
      ? user.favourites.filter(v => v !== villager)
      : [...user.favourites, villager];
    await supabase.from('ac_users').update({ favourites: favs }).eq('id', user.id);
    const updated = { ...user, favourites: favs };
    setUser(updated);
    localStorage.setItem('ac_user', JSON.stringify(updated));
  };

  const toggleWishlist = async (villager: string) => {
    if (!user) return;
    const wl = user.wishlist.includes(villager)
      ? user.wishlist.filter(v => v !== villager)
      : [...user.wishlist, villager];
    await supabase.from('ac_users').update({ wishlist: wl }).eq('id', user.id);
    const updated = { ...user, wishlist: wl };
    setUser(updated);
    localStorage.setItem('ac_user', JSON.stringify(updated));
  };

  const toggleOwned = async (villager: string) => {
    if (!user) return;
    const owned = user.owned.includes(villager)
      ? user.owned.filter(v => v !== villager)
      : [...user.owned, villager];
    await supabase.from('ac_users').update({ owned }).eq('id', user.id);
    const updated = { ...user, owned };
    setUser(updated);
    localStorage.setItem('ac_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateOwned, toggleFavourite, toggleWishlist, toggleOwned }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export { hashSecret };
