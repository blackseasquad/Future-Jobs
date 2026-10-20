import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Notify } from '../types';

const STORAGE_KEY = 'future_careers_favs';

function readLocal(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Favorites live in localStorage for everyone. When a user is signed in,
 * they are also mirrored to public.user_favorites (one row per favorite).
 */
export function useFavorites(user: User | null, notify: Notify) {
  const [favorites, setFavorites] = useState<string[]>(readLocal);
  const userId = user?.id ?? null;

  // Refs let the async sync code always see the latest values
  const favoritesRef = useRef(favorites);
  const userIdRef = useRef<string | null>(userId);
  favoritesRef.current = favorites;
  userIdRef.current = userId;

  const cloudIds = useRef<Set<string>>(new Set()); // career_ids currently stored in the cloud
  const loadedFor = useRef<string | null>(null); // user whose cloud favorites were loaded
  const hadUser = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Diff local favorites against the cloud and push the changes
  const doSync = useCallback(async () => {
    const uid = userIdRef.current;
    if (!supabase || !uid || loadedFor.current !== uid) return;

    const local = new Set(favoritesRef.current);
    const toAdd = [...local].filter((id) => !cloudIds.current.has(id));
    const toRemove = [...cloudIds.current].filter((id) => !local.has(id));

    if (toAdd.length) {
      const { error } = await supabase
        .from('user_favorites')
        .insert(toAdd.map((id) => ({ user_id: uid, career_id: id })));
      if (error) notify('Грешка при запазване: ' + error.message);
      else toAdd.forEach((id) => cloudIds.current.add(id));
    }

    if (toRemove.length) {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', uid)
        .in('career_id', toRemove);
      if (error) notify('Грешка при премахване: ' + error.message);
      else toRemove.forEach((id) => cloudIds.current.delete(id));
    }
  }, [notify]);

  // Serialized so rapid clicks can't create duplicate rows
  const sync = useCallback(() => {
    queue.current = queue.current.then(doSync).catch((e) => console.error('Favorites sync error:', e));
    return queue.current;
  }, [doSync]);

  // Persist locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* storage unavailable */
    }
  }, [favorites]);

  // Sign in / sign out: load and merge cloud favorites, or clear on sign-out
  useEffect(() => {
    if (!supabase) return;

    if (!userId) {
      if (hadUser.current) {
        // Don't leak one account's favorites into the next login
        cloudIds.current = new Set();
        loadedFor.current = null;
        setFavorites([]);
      }
      hadUser.current = false;
      return;
    }

    hadUser.current = true;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('career_id')
        .eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        notify('Неуспешно зареждане на любимите: ' + error.message);
        return;
      }
      cloudIds.current = new Set((data ?? []).map((r: { career_id: string }) => r.career_id));
      loadedFor.current = userId;
      // Merge guest/local favorites with the account's; the sync effect below pushes anything new
      setFavorites((prev) => [...new Set([...prev, ...cloudIds.current])]);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, notify]);

  // Push changes whenever favorites change (no-op until cloud favorites are loaded)
  useEffect(() => {
    void sync();
  }, [favorites, userId, sync]);

  const toggle = useCallback(
    (id: string) => {
      const has = favoritesRef.current.includes(id);
      setFavorites((prev) => (has ? prev.filter((x) => x !== id) : [...prev, id]));
      notify(has ? 'Премахнато от запазени!' : 'Добавено в любими!');
    },
    [notify],
  );

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFavorite };
}
