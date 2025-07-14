import { supabase } from './shared/supabaseConfig.js';
import { getCurrentUser } from './shared/auth.js';

window.supabaseClient = supabase;

// DOM elements
const authUI = document.getElementById('auth');
const gameUI = document.getElementById('game');
const userEmail = document.getElementById('user-email');
const boostButton = document.getElementById('boost-button');
const timerText = document.getElementById('timer-text');

// Constants
const RESET_TIMES_UTC = [0, 12]; // 12AM & 12PM UTC
let currentUser = null;
let hasInitialized = false; // prevents duplicate calls

// Event listeners
document.getElementById('login-google').addEventListener('click', () => login('google'));
document.getElementById('login-discord').addEventListener('click', () => login('discord'));
document.getElementById('logout').addEventListener('click', logout);
boostButton.addEventListener('click', claimBoostPack);

// Toggle Owned
const toggleOwnedButton = document.getElementById('toggle-owned');
let toggleOwnedOnly = false;

document.getElementById('toggle-owned').addEventListener('click', () => {
  toggleOwnedOnly = !toggleOwnedOnly;

  const toggleButton = document.getElementById('toggle-owned');
  toggleButton.classList.toggle('active', toggleOwnedOnly);
  toggleButton.textContent = toggleOwnedOnly ? 'SORT: Show All Cards' : 'SORT: Only Show Owned';

  renderCardGrid();
});

// Rehydrate session after page load
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    currentUser = session.user;
    createUserIfNotExists(currentUser);
    showGame(currentUser);
  } else {
    showLogin();
  }
});

// Listen for future logins or logouts
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    currentUser = session.user;
    createUserIfNotExists(currentUser);
    showGame(currentUser);
  } else {
    showLogin();
  }
});

// --------------------- AUTH ----------------------

async function login(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) console.error('Login error:', error.message);
}

async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentUser = null;
    showLogin();
  } catch (err) {
    console.error("Logout error:", err.message || err);
  }
}

async function checkUserSession(retry = 0) {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (!data?.session && retry < 5) {
      return setTimeout(() => checkUserSession(retry + 1), 300);
    }

    if (error) {
      console.error("Session fetch error:", error);
      showLogin();
    } else if (data?.session?.user) {
      currentUser = data.session.user;
      await createUserIfNotExists(currentUser);
      showGame(currentUser);
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("checkUserSession crash:", err);
    showLogin();
  }
}

async function createUserIfNotExists(user) {
  const { data, error, status } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (error && status !== 406) {
    console.error('User fetch error:', error);
    return;
  }

  if (!data) {
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      last_boost_claim: null,
    });

    if (insertError && insertError.code !== "23505") {
      console.error('User creation failed:', insertError);
    }
  }
}

// ------------------- UI ------------------

function showLogin() {
  authUI.style.display = 'block';
  gameUI.style.display = 'none';
}

window.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    return;
  }

  document.getElementById("display-name").textContent =
    currentUser.display_name || "Player";

  await loadWallet();
  await loadListings();
  setupSellModal();
});

async function showGame(user) {
  if (hasInitialized) return;
  hasInitialized = true;

  currentUser = user;

  const meta = user.user_metadata || {};

  authUI.style.display = 'none';
  gameUI.style.display = 'block';

  checkBoostStatus();
  await renderCardGrid();
}

async function renderCardGrid() {
  const grid = document.getElementById('card-grid');
  grid.innerHTML = '';

  const { data: allCards, error: cardError } = await supabase.from('cards').select('*');
  const { data: userCards, error: userError } = await supabase.from('user_cards')
    .select('card_id, quantity')
    .eq('user_id', currentUser.id);

  if (cardError || userError) {
    console.error('Error loading cards:', cardError || userError);
    return;
  }

  const cardMap = new Map();
  for (const uc of userCards) {
    cardMap.set(uc.card_id, uc.quantity);
  }

  const rarityOrder = { common: 1, uncommon: 2, rare: 3, legendary: 4 };
  let cardsToDisplay = [...allCards];

  if (toggleOwnedOnly) {
    cardsToDisplay = cardsToDisplay.filter(card => cardMap.has(card.id));
  }

  cardsToDisplay.sort((a, b) => {
    const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
    return rarityDiff !== 0 ? rarityDiff : a.id - b.id;
  });

  for (const card of cardsToDisplay) {
    const quantity = cardMap.get(card.id) || 0;
    const imgPath = `./cards/${String(card.id).padStart(3, '0')}.png`;

    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    if (quantity > 0) cardDiv.classList.add('owned');

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = imgPath;
    img.alt = card.name;
    cardDiv.appendChild(img);

    if (quantity > 0) {
      const badge = document.createElement('div');
      badge.className = 'quantity';
      badge.textContent = `x${quantity}`;
      cardDiv.appendChild(badge);
    }

    grid.appendChild(cardDiv);
  }
}


// ---------------- BOOSTER PACK (formerly DAILY)  ------------------

function getNextBoostReset() {
  const now = new Date();
  const utcHours = now.getUTCHours();

  // Determine next reset time
  let nextResetHour = RESET_TIMES_UTC.find(h => h > utcHours);
  if (nextResetHour === undefined) nextResetHour = RESET_TIMES_UTC[0];

  const resetTime = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    nextResetHour,
    0,
    0,
    0
  ));

  // If we've passed all today’s reset times, move to tomorrow
  if (resetTime <= now) {
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
  }

  return resetTime;
}

async function checkBoostStatus() {
  const { data, error } = await supabase
    .from('users')
    .select('last_boost_claim')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('Boost fetch error:', error);
    return;
  }

  const lastClaim = data.last_boost_claim ? new Date(data.last_boost_claim) : null;
  const now = new Date();
  const nextReset = getNextBoostReset();

  const resetWindowStart = new Date(nextReset.getTime() - 12 * 60 * 60 * 1000); // 12 hrs before next

  if (!lastClaim || lastClaim < resetWindowStart) {
    boostButton.disabled = false;
    boostButton.style.opacity = 1;
    timerText.textContent = '';
  } else {
    boostButton.disabled = true;
    boostButton.style.opacity = 0.5;
    startCountdown(nextReset - now);
  }
}

async function claimBoostPack() {
  boostButton.disabled = true;
  boostButton.style.opacity = 0.5;

  const cards = await getRandomCardPack();
  await giveCardsToUser(cards);

  // Fetches current wallet balance
  const { data: userData, error } = await supabase
    .from('users')
    .select('wallet')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error("Failed to fetch user wallet:", error);
    boostButton.disabled = false;
    return;
  }

  const newWallet = (userData.wallet ?? 0) + 99;

  // Updates boost claim time and wallet balance
  await supabase
    .from('users')
    .update({
      last_boost_claim: new Date().toISOString(),
      wallet: newWallet
    })
    .eq('id', currentUser.id);

  showBoostModal(cards);
  await renderCardGrid();
  await checkBoostStatus();

  // Update wallet display
  const walletSpan = document.getElementById('wallet-balance');
  if (walletSpan) walletSpan.textContent = newWallet;
}

// Keep outside of claimBoostPack()
function getCardImageUrl(cardId) {
  const paddedId = String(cardId).padStart(3, '0');
  return `./cards/${paddedId}.png`;
}

function showBoostModal(cards) {
  const modal = document.getElementById('boost-modal');
  const modalCards = document.getElementById('modal-cards');
  const modalDate = document.getElementById('boost-modal-date');

  console.log("modal:", modal);
  console.log("modalCards:", modalCards);
  console.log("modalDate:", modalDate);

  // Exit early if any modal element is missing
  if (!modal || !modalCards || !modalDate) {
    console.warn("Boost modal elements not found. Skipping modal display.");
    return;
  }

  modalDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  modalCards.innerHTML = '';
  for (const card of cards) {
    const img = document.createElement('img');
    img.src = getCardImageUrl(card.id);
    img.alt = card.name;
    modalCards.appendChild(img);
  }

  modal.classList.remove('hidden');
}

// Close button listener (only needs to be set once)
const closeModalButton = document.getElementById('boost-modal-close');
const boostModal = document.getElementById('boost-modal');

if (closeModalButton && boostModal) {
  closeModalButton.addEventListener('click', () => {
    boostModal.classList.add('hidden');
  });
}

// --------------- CARDS ----------------

async function getRandomCardPack() {
  const { data: cards, error } = await supabase.from('cards').select('*');
  if (error) {
    console.error('Card fetch error:', error);
    return [];
  }

  const byRarity = {
    common: cards.filter(c => c.rarity === 'common'),
    uncommon: cards.filter(c => c.rarity === 'uncommon'),
    rare: cards.filter(c => c.rarity === 'rare'),
    legendary: cards.filter(c => c.rarity === 'legendary'),
  };

  const weights = { common: 70, uncommon: 20, rare: 8, legendary: 2 };
  const result = [];

  for (let i = 0; i < 5; i++) {
    const rarity = pickWeightedRarity(weights);
    const options = byRarity[rarity];

    if (options.length > 0) {
      const card = options[Math.floor(Math.random() * options.length)];
      result.push(card);
    } else {
      console.warn(`No cards found for rarity: ${rarity}`);
    }

  }

  console.log("Cards by rarity:", {
    common: byRarity.common.length,
    uncommon: byRarity.uncommon.length,
    rare: byRarity.rare.length,
    legendary: byRarity.legendary.length,
  });

  return result;
}

function pickWeightedRarity(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    if (rand < weight) return rarity;
    rand -= weight;
  }
  return 'common';
}

async function giveCardsToUser(cards) {
  for (const card of cards) {
    console.log(`Attempting to give card ${card.name} (ID: ${card.id}) to user ${currentUser.id}`);

    const { data: existing, error } = await supabase
      .from('user_cards')
      .select('quantity')
      .eq('user_id', currentUser.id)
      .eq('card_id', card.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking for existing card:', error);
      continue;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_cards')
        .update({ quantity: existing.quantity + 1 })
        .eq('user_id', currentUser.id)
        .eq('card_id', card.id);

      if (updateError) {
        console.error('Failed to update quantity:', updateError);
      } else {
        console.log(`Updated quantity of card ${card.id}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_cards')
        .insert({
          user_id: currentUser.id,
          card_id: card.id,
          quantity: 1
        });

      if (insertError) {
        console.error('Failed to insert new card:', insertError);
      } else {
        console.log(`Inserted new card ${card.id}`);
      }
    }
  }
}

function startCountdown(durationMs) {
  const timerText = document.getElementById('timer-text');
  const endTime = Date.now() + durationMs;

  function update() {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      timerText.textContent = 'You can now claim your boost!';
      boostButton.disabled = false;
      boostButton.style.opacity = 1;
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    timerText.textContent = `Next Boost Pack in ${hours}h ${minutes}m ${seconds}s`;
    requestAnimationFrame(update); // smoother than setInterval
  }

  update();
}