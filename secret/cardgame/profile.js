import { supabase } from './shared/supabaseConfig.js';
import { getCurrentUser } from './shared/auth.js';

window.addEventListener("DOMContentLoaded", async () => {
  const user = await getCurrentUser();
  if (!user) return;

  loadProfile(user.id);

  document.getElementById("save-profile").addEventListener("click", async () => {
    const name = document.getElementById("display-name").value.trim();
    if (!name) return;

    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: name,
    });

    const msgEl = document.getElementById("profile-message");
    msgEl.textContent = error ? "Error saving profile." : "Profile updated!";
    msgEl.style.color = error ? "red" : "green";
  });
});

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .single();

  if (data && data.display_name) {
    document.getElementById("display-name").value = data.display_name;
  }
}
