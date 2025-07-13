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

    async function loadOwnedCards() {
    const { data, error } = await supabase
        .from("cards")
        .select("id, name")
        .eq("owner_id", currentUser.id);

    const container = document.getElementById("owned-card-list");
    container.innerHTML = "";

    if (error) {
        console.error("Failed to load cards:", error);
        return;
    }

    data.forEach((card) => {
        const cardEl = document.createElement("div");
        cardEl.className = "card-item";
        cardEl.dataset.cardId = card.id;

        const img = document.createElement("img");
        img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
        img.alt = card.name;

        cardEl.appendChild(img);

        cardEl.addEventListener("click", () => {
        // Deselect previous card if any
        if (selectedCard && selectedCard !== cardEl) {
            selectedCard.classList.remove("selected");
            const oldControls = selectedCard.querySelector(".sell-controls");
            if (oldControls) oldControls.remove();
        }

        // Toggle selection
        const isSelected = selectedCard === cardEl;
        if (isSelected) {
            selectedCard.classList.remove("selected");
            const controls = selectedCard.querySelector(".sell-controls");
            if (controls) controls.remove();
            selectedCard = null;
            return;
        }

        selectedCard = cardEl;
        cardEl.classList.add("selected");

        const controls = document.createElement("div");
        controls.className = "sell-controls";
        controls.innerHTML = `
            <input type="number" placeholder="Price" min="1" />
            <button class="list-btn">List Card</button>
        `;
        cardEl.appendChild(controls);

        const listCardBtn = controls.querySelector(".list-btn");

        listCardBtn.addEventListener("click", async () => {
            const priceInput = selectedCard.querySelector("input");
            const price = parseInt(priceInput?.value);
            const listBtn = selectedCard.querySelector(".list-btn");

            if (!selectedCard || isNaN(price) || price <= 0) {
            alert("Invalid price or card.");
            return;
            }

            listBtn.disabled = true;
            listBtn.style.opacity = "0.5";

            const cardId = selectedCard.dataset.cardId;

            const { error } = await supabase.from("market_listings").insert([
            {
                card_id: cardId,
                seller_id: currentUser.id,
                price: price,
            },
            ]);

            if (error) {
            alert("Failed to list card.");
            console.error(error);
            listBtn.disabled = false;
            listBtn.style.opacity = "1";
            return;
            }

            setTimeout(() => {
            loadOwnedCards();
            }, 350);

            setTimeout(() => {
            priceInput.value = "";
            listBtn.disabled = false;
            listBtn.style.opacity = "1";
            }, 400);
        });
        });

        container.appendChild(cardEl);
    });
    }


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

