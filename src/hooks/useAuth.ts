import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { NOT_CONFIGURED_MESSAGE, supabase } from '../lib/supabase';
import type { Notify } from '../types';

export function useAuth(notify: Notify) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // Fires immediately with INITIAL_SESSION, then on every sign-in / sign-out.
    // Don't call other Supabase methods inside this callback (can deadlock the client).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        notify(NOT_CONFIGURED_MESSAGE);
        return false;
      }
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          notify('Грешка при вход: ' + error.message);
          return false;
        }
        notify('Успешен вход!');
        return true;
      } catch (e) {
        notify('Няма връзка със Supabase: ' + (e as Error).message);
        return false;
      }
    },
    [notify],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        notify(NOT_CONFIGURED_MESSAGE);
        return false;
      }
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          notify('Грешка при регистрация: ' + error.message);
          return false;
        }
        notify(
          data.session
            ? 'Регистрацията е успешна!'
            : 'Проверете имейла си, за да потвърдите регистрацията.',
        );
        return true;
      } catch (e) {
        notify('Няма връзка със Supabase: ' + (e as Error).message);
        return false;
      }
    },
    [notify],
  );

  const signInAnonymously = useCallback(async () => {
    if (!supabase) {
        notify(NOT_CONFIGURED_MESSAGE);
        return false;
      }
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        notify('Анонимният вход не е активиран в настройките на Supabase.');
        return false;
      }
      notify('Влязохте като анонимен гост.');
      return true;
    } catch (e) {
      notify('Няма връзка със Supabase: ' + (e as Error).message);
      return false;
    }
  }, [notify]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    notify('Успешно излязохте.');
  }, [notify]);

  return { user, signIn, signUp, signInAnonymously, signOut };
}
