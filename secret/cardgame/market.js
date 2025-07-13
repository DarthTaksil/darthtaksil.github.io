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

  document.getElementById("market-username").textContent =
    currentUser.display_name || "Player";
    
  await loadWallet();
  await loadYourListings();
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



// Load user listings


async function loadYourListings() {
  const { data, error } = await supabase
    .from("market_listings")
    .select(`
      id,
      price,
      card:card_id (
        id,
        name
      )
    `)
    .eq("is_sold", false)
    .eq("seller_id", currentUser.id);

  if (error) {
    console.error("Failed to load your listings:", error);
    return;
  }

  const container = document.getElementById("your-listings-grid");
  container.innerHTML = "";

  data.forEach((listing) => {
    const card = listing.card;

    const cardEl = document.createElement("div");
    cardEl.className = "market-card";

    const img = document.createElement("img");
    img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
    img.alt = card.name;

    const priceDiv = document.createElement("div");
    priceDiv.className = "card-price";
    priceDiv.textContent = `${listing.price} 🪙`;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove Listing";
    removeBtn.className = "remove-listing-btn";
    removeBtn.addEventListener("click", async () => {
      const confirmed = confirm("Remove this listing?");
      if (!confirmed) return;

      const { error } = await supabase
        .from("market_listings")
        .delete()
        .eq("id", listing.id);

      if (error) {
        console.error("Failed to delete listing:", error);
        alert("Could not remove listing.");
      } else {
        loadYourListings(); // Refresh
        loadListings();     // Refresh global listings
      }
    });

    cardEl.appendChild(img);
    cardEl.appendChild(priceDiv);
    cardEl.appendChild(removeBtn);

    container.appendChild(cardEl);
  });
}



// Load card listings from other users


async function loadListings() {
  // Get market listings
  const { data: listings, error: listingsError } = await supabase
    .from("market_listings")
    .select(`
      id,
      price,
      is_sold,
      seller_id,
      card:card_id (
        id,
        name
      )
    `)
    .eq("is_sold", false)
    .neq("seller_id", currentUser.id);

  if (listingsError) {
    console.error("Failed to fetch listings", listingsError);
    return;
  }

  // Extract unique seller_ids
  const sellerIds = [...new Set(listings.map(listing => listing.seller_id))];

  // Fetch profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", sellerIds);

  if (profilesError) {
    console.error("Failed to fetch profiles", profilesError);
    return;
  }

  // Create a quick lookup map
  const sellerMap = {};
  profiles.forEach(profile => {
    sellerMap[profile.user_id] = profile.display_name;
  });

  // Render cards
  const container = document.getElementById("market-grid");
  container.innerHTML = "";

  listings.forEach((listing) => {
    const card = listing.card;
    const sellerName = sellerMap[listing.seller_id] || "Unknown";

    const cardEl = document.createElement("div");
    cardEl.className = "market-card";

    const img = document.createElement("img");
    img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
    img.alt = card.name;

    const sellerDiv = document.createElement("div");
    sellerDiv.className = "card-seller";
    sellerDiv.textContent = `Seller: ${sellerName}`;

    const priceDiv = document.createElement("div");
    priceDiv.className = "card-price";
    priceDiv.textContent = `${listing.price} 🪙`;

    cardEl.appendChild(img);
    cardEl.appendChild(sellerDiv);
    cardEl.appendChild(priceDiv);

    container.appendChild(cardEl);
  });
}



// ----------- SELL CARD MODAL ----------


function setupSellModal() {
  const modal = document.getElementById("sell-modal");
  const overlay = document.getElementById("sell-modal-overlay");
  const closeBtn = document.getElementById("sell-modal-close");

  closeBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    modal.classList.add("hidden");
  });

  document.getElementById("sell-card-btn").addEventListener("click", () => {
    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    loadOwnedCards();
  });
}

let selectedCard = null;

async function loadOwnedCards() {
const { data, error } = await supabase
  .from("user_cards")
  .select(`
    card_id,
    quantity,
    cards (
      id,
      name
    )
  `)
  .eq("user_id", currentUser.id)
  .gt("quantity", 0);

  const container = document.getElementById("sell-card-list");
  container.innerHTML = "";

  if (error) {
    console.error("Failed to load cards:", error);
    return;
  }

  data.forEach((card) => {
    const cardEl = document.createElement("li");
    cardEl.className = "card-item";
    cardEl.dataset.cardId = card.card_id;

    const img = document.createElement("img");
    img.src = `./cards/${String(card.cards.id).padStart(3, '0')}.png`;
    img.alt = card.cards.name;

    cardEl.appendChild(img);

  cardEl.addEventListener("click", (e) => {
    if (e.target.closest(".sell-controls")) {
      return; // Ignore clicks inside sell-controls
    }

    // Deselect previous
    if (selectedCard && selectedCard !== cardEl) {
      selectedCard.classList.remove("selected");
      const oldControls = selectedCard.querySelector(".sell-controls");
      if (oldControls) oldControls.remove();
    }

    // Toggle
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
        <input type="number" class="price-input" placeholder="Price" min="1" />
        <button class="list-btn">List Card</button>
      `;
      cardEl.appendChild(controls);

      const listCardBtn = controls.querySelector(".list-btn");

      listCardBtn.addEventListener("click", async () => {
        const priceInput = controls.querySelector(".price-input");
        const price = parseInt(priceInput?.value);

        if (!selectedCard || isNaN(price) || price <= 0 || !Number.isInteger(price)) {
          alert("Invalid price. Must be a positive whole number.");
          return;
        }

        listCardBtn.disabled = true;
        listCardBtn.style.opacity = "0.5";

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
          listCardBtn.disabled = false;
          listCardBtn.style.opacity = "1";
          return;
        }

        // Remove card visually
        selectedCard.remove();
        selectedCard = null;

        // Fetch current quantity
        const { data: existingEntry, error: fetchError } = await supabase
          .from("user_cards")
          .select("quantity")
          .eq("user_id", currentUser.id)
          .eq("card_id", parseInt(cardId))
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching card quantity:", fetchError);
          alert("Could not update your card inventory.");
          return;
        }

        let updateError = null;
        const newQty = existingEntry.quantity - 1;

        // If new quantity is 0, delete the row
        if (newQty <= 0) {
          console.log("Updating user_cards where", {
            user_id: currentUser.id,
            card_id: parseInt(cardId),
            newQty
          });

          let updatedRow, updateError;
          const { error: deleteError } = await supabase
            .from("user_cards")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("card_id", parseInt(cardId))
            .select();

            updatedRow = result.data;
            updateError = result.error;

            console.log("Updated row:", updatedRow);

            if (updateError) {
              console.error("Failed to update card quantity:", updateError);
              alert("Failed to update your inventory.");
            } else if (updatedRow.length === 0) {
              console.warn("No matching user_cards row found to update.");
              alert("No matching card found to update.");
            }

          if (deleteError) {
            console.error("Failed to delete card:", deleteError);
            alert("Failed to update your inventory.");
          }
        }else {
          // Otherwise, just update quantity
          const result = await supabase
            .from("user_cards")
            .update({ quantity: newQty })
            .eq("user_id", currentUser.id)
            .eq("card_id", parseInt(cardId));

          console.log("Attempting to update user_cards", {
            user_id: currentUser.id,
            card_id: parseInt(cardId),
            newQty
          });

          const updateError = result.error;

          if (updateError) {
            console.error("Failed to update card quantity:", updateError);
            alert("Failed to update your inventory.");
          }
        }


        if (updateError) {
          console.error("Failed to reduce card quantity:", updateError);
          alert("Failed to update your card inventory.");
        }

        setTimeout(() => {
          loadOwnedCards();
        }, 350);

        setTimeout(() => {
          priceInput.value = "";
          listCardBtn.disabled = false;
          listCardBtn.style.opacity = "1";
        }, 400);
      });
    });

    container.appendChild(cardEl);
  });
}

