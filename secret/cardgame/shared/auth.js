// /shared/auth.js
import { supabase } from './supabase.js';

export async function getCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) return null;

  // Fetch display_name from `profiles` table
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .single();

  return {
    ...user,
    display_name: profile?.display_name || null
  };
}