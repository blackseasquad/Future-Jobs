import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null when the env vars are missing, so the app still works offline (localStorage only). */
export const supabase = url && key ? createClient(url, key) : null;

export const NOT_CONFIGURED_MESSAGE =
  'Supabase не е конфигуриран. Добавете VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.';
