import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'future_jobs_known_skills';

function readLocal(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Skills the visitor already has. Stored in localStorage for everyone and, for signed-in users,
 * in the existing Supabase account (user_metadata.known_skills) — no new profile table.
 */
export function useKnownSkills(user: User | null) {
  const [known, setKnown] = useState<string[]>(readLocal);

  useEffect(() => {
    const remote = user?.user_metadata?.known_skills;
    if (Array.isArray(remote)) {
      setKnown((local) => [...new Set([...local, ...remote.filter((x: unknown) => typeof x === 'string')])]);
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(known));
    } catch {
      /* storage unavailable */
    }
  }, [known]);

  const toggle = useCallback(
    (id: string) => {
      const next = known.includes(id) ? known.filter((x) => x !== id) : [...known, id];
      setKnown(next);
      if (supabase && user) void supabase.auth.updateUser({ data: { known_skills: next } });
    },
    [known, user],
  );

  return { known, toggle };
}
