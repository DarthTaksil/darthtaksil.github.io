// Supabase setup
const SUPABASE_URL = 'https://cbzkrfqhtofxaypsisdg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemtyZnFodG9meGF5cHNpc2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzAzMjIsImV4cCI6MjA2NzUwNjMyMn0._sNhhbWUih9NUhlENcphukX-74Q7imzMg5w-ZQh0oW4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabase; // helpful for debugging

// DOM elements
const authUI = document.getElementById('auth');
const gameUI = document.getElementById('game');
const userEmail = document.getElementById('user-email');
const dailyButton = document.getElementById('daily-button');
const timerText = document.getElementById('timer-text');

// Constants
const claimCooldown = 24 * 60 * 60 * 1000;
let currentUser = null;

// Event listeners
document.getElementById('login-google').addEventListener('click', () => login('google'));
document.getElementById('login-discord').addEventListener('click', () => login('discord'));
document.getElementById('logout').addEventListener('click', logout);
dailyButton.addEventListener('click', claimDailyPack);

// Toggle Owned
const filterOwnedButton = document.getElementById('toggle-owned');
let filterOwnedOnly = false;

document.getElementById('toggle-owned').addEventListener('click', () => {
  filterOwnedOnly = !filterOwnedOnly;
  document.getElementById('toggle-owned').classList.toggle('active', filterOwnedOnly);
  renderCardGrid();
});

// Try to restore session
checkUserSession();

// Listen for auth changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    await createUserIfNotExists(session.user);
    showGame(session.user);
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
    .maybeSingle();  // Use maybeSingle instead of single()

  if (error && status !== 406) {
    console.error('User fetch error:', error);
    return;
  }

  if (!data) {
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      last_daily_claim: null,
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

async function showGame(user) {
  currentUser = user;
  userEmail.textContent = user.email || user.user_metadata.full_name || 'Player';
  authUI.style.display = 'none';
  gameUI.style.display = 'block';
  checkDailyStatus();
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

  // Always sort by rarity, then name
  const rarityOrder = { common: 1, uncommon: 2, rare: 3, legendary: 4 };
  const cardsToDisplay = [...allCards].sort((a, b) => {
    const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
    if (rarityDiff !== 0) return rarityDiff;
    return a.id - b.id; // Sort by numeric ID after rarity
  });

  if (filterOwnedOnly) {
    cardsToDisplay = cardsToDisplay.filter(card => cardMap.has(card.id));
  }

  for (const card of cardsToDisplay) {
    const quantity = cardMap.get(card.id) || 0;
    const imgPath = `./cards/${String(card.id).padStart(3, '0')}.png`;

    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    if (quantity > 0) cardDiv.classList.add('owned');

    const img = document.createElement('img');
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


// ---------------- DAILY ------------------

async function checkDailyStatus() {
  const { data, error } = await supabase
    .from('users')
    .select('last_daily_claim')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('Daily fetch error:', error);
    return;
  }

  const lastClaim = data.last_daily_claim ? new Date(data.last_daily_claim) : null;
  const now = new Date();
  const diff = lastClaim ? now - lastClaim : Infinity;

  if (!lastClaim || diff >= claimCooldown) {
    dailyButton.disabled = false;
    dailyButton.style.opacity = 1;
    timerText.textContent = '';
  } else {
    dailyButton.disabled = true;
    dailyButton.style.opacity = 0.5;
    startCountdown(claimCooldown - diff);
  }
}

function startCountdown(duration) {
  const endTime = Date.now() + duration;
  const interval = setInterval(() => {
    const msLeft = endTime - Date.now();
    if (msLeft <= 0) {
      clearInterval(interval);
      timerText.textContent = '';
      dailyButton.disabled = false;
      dailyButton.style.opacity = 1;
    } else {
      const hours = Math.floor(msLeft / 3600000);
      const minutes = Math.floor((msLeft % 3600000) / 60000);
      const seconds = Math.floor((msLeft % 60000) / 1000);
      timerText.textContent = `Next pack in ${hours}h ${minutes}m ${seconds}s`;
    }
  }, 1000);
}

async function claimDailyPack() {

  // Disable the button right away
  dailyButton.disabled = true;
  dailyButton.style.opacity = 0.5;

  const now = new Date().toISOString();
  const newCards = await getRandomCardPack();

  const { error } = await supabase
    .from('users')
    .update({ last_daily_claim: now })
    .eq('id', currentUser.id);

  if (error) {
    console.error('Failed to update daily claim:', error);
    // Re-enable button so user can retry
    dailyButton.disabled = false;
    dailyButton.style.opacity = 1;
    return;
  }

  await giveCardsToUser(newCards);

  showDailyModal(newCards);

  await renderCardGrid();

  // start countdown immediately after claim
  checkDailyStatus();
}

// Keep outside of claimDailyPack()
function getCardImageUrl(cardId) {
  const paddedId = String(cardId).padStart(3, '0');
  return `./cards/${paddedId}.png`;
}

function showDailyModal(cards) {
  const modal = document.getElementById('daily-modal');
  const modalCards = document.getElementById('modal-cards');
  const modalDate = document.getElementById('modal-date');

  // Set today's date
  const today = new Date();
  modalDate.textContent = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Clear previous content
  modalCards.innerHTML = '';

  // Add card images
  for (const card of cards) {
    const img = document.createElement('img');
    img.src = getCardImageUrl(card.id);
    img.alt = card.name;
    modalCards.appendChild(img);
  }

  // Show the modal
  modal.classList.remove('hidden');
}

// Close button listener (only needs to be set once)
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('daily-modal').classList.add('hidden');
});

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
