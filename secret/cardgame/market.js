import { getCurrentUser } from './shared/auth.js';
import { supabase } from './shared/supabaseConfig.js';

document.addEventListener("DOMContentLoaded", async () => {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/secret/cardgame/index.html";
    return;
  }

  document.getElementById("market-username").textContent = user.user_metadata?.full_name || "Player";

  const { data: userData } = await supabase
    .from("users")
    .select("wallet")
    .eq("id", user.id)
    .single();

  if (userData) {
    document.getElementById("market-wallet-amount").textContent = userData.wallet ?? 0;
  }

  loadMarketListings();
});

// Load and display all cards in the market
async function loadMarketListings() {
  const { data, error } = await supabase
    .from("market_listings")
    .select('*, cards(*), seller:users!market_listings_seller_id_fkey(*)')
    .order("id", { ascending: false });

  if (error) {
    console.error("Failed to fetch listings", error);
    return;
  }

  const grid = document.getElementById("market-grid");
  grid.innerHTML = "";

  for (const listing of data) {
    const cardId = String(listing.card_id).padStart(3, '0');
    const cardName = listing.cards?.name || "Unknown Card";
    const seller = listing.users?.username || listing.seller_id;

    const cardEl = document.createElement("div");
    cardEl.className = "market-card";

    cardEl.innerHTML = `
      <div class="card-seller">${seller}</div>
      <img src="./cards/${cardId}.png" alt="${cardName}" />
      <div class="card-price">${listing.price} Clint Coin</div>
    `;

    grid.appendChild(cardEl);
  }
}
