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

  document.getElementById("buy-modal-close").addEventListener("click", () => {
    document.getElementById("buy-modal-overlay").classList.add("hidden");
  });
    
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

      // Step 1: Delete the listing
      const { error: deleteError } = await supabase
        .from("market_listings")
        .delete()
        .eq("id", listing.id);

      if (deleteError) {
        console.error("Failed to delete listing:", deleteError);
        alert("Could not remove listing.");
        return;
      }

      // Step 2: Restore the card to user_cards
      const { data: existingEntry, error: fetchError } = await supabase
        .from("user_cards")
        .select("quantity")
        .eq("user_id", currentUser.id)
        .eq("card_id", card.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Failed to check for existing user_card:", fetchError);
        alert("Listing removed, but failed to restore card to inventory.");
        return;
      }

      if (existingEntry) {
        // Update quantity +1
        const { error: updateError } = await supabase
          .from("user_cards")
          .update({ quantity: existingEntry.quantity + 1 })
          .eq("user_id", currentUser.id)
          .eq("card_id", card.id);

        if (updateError) {
          console.error("Failed to update quantity:", updateError);
          alert("Listing removed, but card quantity update failed.");
        }
      } else {
        // No existing row, insert new one
        const { error: insertError } = await supabase
          .from("user_cards")
          .insert({
            user_id: currentUser.id,
            card_id: card.id,
            quantity: 1,
          });

        if (insertError) {
          console.error("Failed to reinsert card:", insertError);
          alert("Listing removed, but reinserting card failed.");
        }
      }

      // Refresh both views
      loadYourListings();
      loadListings();
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
  let sellerMap = {};
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

  // Lookup map
  sellerMap = {};
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

    cardEl.addEventListener("click", () => {
      openBuyModal(listing); // This calls the modal opening function
    });

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
          loadYourListings();
          loadListings();
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




  // BUYING MECHANIC  


async function handleBuy(listing) {
  // Get buyer wallet
  const { data: walletData, error: walletError } = await supabase
    .from("users")
    .select("wallet")
    .eq("id", currentUser.id)
    .single();

  if (walletError || walletData.wallet < listing.price) {
    alert("Insufficient Clint Coin.");
    return;
  }

  // 1. Deduct buyer's wallet
  const { error: deductError } = await supabase
    .from("users")
    .update({ wallet: walletData.wallet - listing.price })
    .eq("id", currentUser.id);

  if (deductError) {
    alert("Transaction failed at wallet deduction.");
    return;
  }

  // 2. Update listing as sold
  const { error: soldError } = await supabase
    .from("market_listings")
    .update({
      is_sold: true,
      buyer_id: currentUser.id,
      sold_at: new Date().toISOString()
    })
    .eq("id", listing.id);

  if (soldError) {
    alert("Transaction failed at marking listing sold.");
    return;
  }

  // 3. Give card to buyer (insert/update user_cards)
  const { data: userCard, error: userCardError } = await supabase
    .from("user_cards")
    .select("quantity")
    .eq("user_id", currentUser.id)
    .eq("card_id", listing.card.id)
    .maybeSingle();

  if (userCardError) {
    alert("Purchase succeeded, but failed to deliver card.");
    return;
  }

  if (userCard) {
    await supabase
      .from("user_cards")
      .update({ quantity: userCard.quantity + 1 })
      .eq("user_id", currentUser.id)
      .eq("card_id", listing.card.id);
  } else {
    await supabase.from("user_cards").insert({
      user_id: currentUser.id,
      card_id: listing.card.id,
      quantity: 1,
    });
  }

  alert("Purchase successful!");
  document.getElementById("buy-modal-overlay").classList.add("hidden");

  // Refresh the market
  loadWallet();
  loadListings();
  loadYourListings();
}

async function openBuyModal(listing) {
  document.getElementById("buy-modal-overlay").classList.remove("hidden");

  document.getElementById("buy-card-img").src = `./cards/${String(listing.card.id).padStart(3, '0')}.png`;
  document.getElementById("buy-seller-name").textContent = sellerMap[listing.seller_id] || "Unknown";
  document.getElementById("buy-listed-time").textContent = timeSince(new Date(listing.created_at));
  document.getElementById("buy-card-price").textContent = `${listing.price} 🪙`;

  const confirmBox = document.getElementById("buy-confirmation");
  document.getElementById("buy-confirm-btn").onclick = () => confirmBox.classList.remove("hidden");
  document.getElementById("buy-no-btn").onclick = () => confirmBox.classList.add("hidden");
  document.getElementById("buy-yes-btn").onclick = () => {
    confirmBox.classList.add("hidden");
    handleBuy(listing);
  };

  await loadSimilarListings(listing.card.id, listing.id);
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = [
    { label: "year", secs: 31536000 },
    { label: "month", secs: 2592000 },
    { label: "day", secs: 86400 },
    { label: "hour", secs: 3600 },
    { label: "minute", secs: 60 },
    { label: "second", secs: 1 }
  ];
  for (let i of intervals) {
    const count = Math.floor(seconds / i.secs);
    if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
  }
  return "just now";
}

async function loadSimilarListings(cardId, excludeListingId) {
  const { data, error } = await supabase
    .from("market_listings")
    .select(`
      id,
      price,
      seller_id,
      card:card_id (
        id,
        name
      )
    `)
    .eq("is_sold", false)
    .eq("card_id", cardId)
    .neq("id", excludeListingId)
    .order("price", { ascending: true });

  const container = document.getElementById("similar-listings");
  container.innerHTML = "";

  if (error) {
    console.error("Failed to load similar listings", error);
    return;
  }

  data.forEach((listing) => {
    const cardEl = document.createElement("div");
    cardEl.className = "similar-card";

    const img = document.createElement("img");
    img.src = `./cards/${String(listing.card.id).padStart(3, '0')}.png`;
    img.alt = listing.card.name;

    const priceText = document.createElement("div");
    priceText.textContent = `${listing.price} 🪙`;

    cardEl.appendChild(img);
    cardEl.appendChild(priceText);

    cardEl.addEventListener("click", () => {
      openBuyModal(listing); // Clicking one loads its own modal
    });

    container.appendChild(cardEl);
  });
}
