// market.js

import { getCurrentUser } from './shared/auth.js';
import { supabase } from './shared/supabaseConfig.js';

let currentUser = null;

// On page load
window.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "/secret/cardgame/index.html";
    return;
  }

  document.getElementById("market-username").textContent = currentUser.user_metadata.full_name || "Player";
  await loadWallet();
  await loadListings();
  setupSellModal();
});

// Load wallet balance
async function loadWallet() {
  const { data, error } = await supabase
    .from("users")
    .select("wallet")
    .eq("id", currentUser.id)
    .single();

  if (data) {
    document.getElementById("market-wallet").textContent = data.wallet ?? 0;
  }
}

// Load card listings from other users
async function loadListings() {
  const { data, error } = await supabase
    .from("market_listings")
    .select(`id, price, card:card_id ( id, name ), seller:seller_id ( user_metadata )`)
    .neq("seller_id", currentUser.id);

  if (error) {
    console.error("Failed to fetch listings", error);
    return;
  }

  const container = document.getElementById("market-listings");
  container.innerHTML = "";

  data.forEach((listing) => {
    const card = listing.card;
    const seller = listing.seller?.user_metadata?.full_name || "Seller";

    const cardEl = document.createElement("div");
    cardEl.className = "market-card";
    cardEl.innerHTML = `
      <div class="seller">${seller}</div>
      <img src="./cards/${String(card.id).padStart(3, '0')}.png" alt="${card.name}" />
      <div class="price">${listing.price} Clint Coins</div>
    `;

    container.appendChild(cardEl);
  });
}

// ----------- SELL CARD MODAL ----------
function setupSellModal() {
  const sellBtn = document.getElementById("sell-card-btn");
  const sellModalOverlay = document.getElementById("sell-modal-overlay");
  const sellCardList = document.getElementById("sell-card-list");
  const sellCardDetails = document.getElementById("sell-card-details");
  const listCardBtn = document.getElementById("list-card-btn");
  const priceInput = document.getElementById("sell-card-price");
  const closeBtn = document.getElementById("sell-modal-close");

  let selectedCard = null;

  sellBtn.addEventListener("click", async () => {
    sellCardList.innerHTML = "";
    sellModalOverlay.classList.remove("hidden");
    sellCardDetails.classList.add("hidden");
    selectedCard = null;

    const { data, error } = await supabase
      .from("user_cards")
      .select("card_id, card:card_id ( id, name )")
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Error loading user cards", error);
      return;
    }

    data.forEach((entry) => {
      const li = document.createElement("li");
      li.setAttribute("data-card-id", entry.card.id);

      const img = document.createElement("img");
      img.src = `./cards/${String(entry.card.id).padStart(3, '0')}.png`;
      img.alt = entry.card.name;
      li.appendChild(img);

      li.addEventListener("click", () => {
        if (selectedCard?.id === entry.card.id) {
          li.classList.remove("selected");
          selectedCard = null;
          sellCardDetails.classList.add("hidden");
        } else {
          document.querySelectorAll("#sell-card-list li").forEach((el) => el.classList.remove("selected"));
          li.classList.add("selected");
          selectedCard = entry.card;
          sellCardDetails.classList.remove("hidden");
        }
      });

      sellCardList.appendChild(li);
    });
  });

    listCardBtn.addEventListener("click", async () => {
        if (!selectedCard) return;

        const priceInput = selectedCard.querySelector("input");
        const listBtn = selectedCard.querySelector("button");

        const price = parseInt(priceInput?.value);
        if (isNaN(price) || price <= 0) {
            alert("Invalid price.");
            return;
        }

        // Disable the button and gray it out
        listBtn.disabled = true;
        listBtn.style.opacity = "0.5";
        listBtn.style.pointerEvents = "none";

        // Submit to Supabase
        const { error } = await supabase.from("market_listings").insert([
            {
            card_id: selectedCard.dataset.cardId,
            seller_id: currentUser.id,
            price: price,
            },
        ]);

        if (error) {
            alert("Failed to list card.");
            console.error(error);
            listBtn.disabled = false;
            listBtn.style.opacity = "1";
            listBtn.style.pointerEvents = "auto";
            return;
        }

        // Schedule card grid refresh
        setTimeout(() => {
            loadOwnedCards(); // ✅ refresh the card grid
        }, 350);

        // Clear price and unlock button after 400ms
        setTimeout(() => {
            priceInput.value = "";
            listBtn.disabled = false;
            listBtn.style.opacity = "1";
            listBtn.style.pointerEvents = "auto";
        }, 400);
    });

  closeBtn.addEventListener("click", () => {
    sellModalOverlay.classList.add("hidden");
  });
}
