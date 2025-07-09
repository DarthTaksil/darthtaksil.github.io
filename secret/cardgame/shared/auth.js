// /shared/auth.js
import { supabase } from './supabase.js';

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}