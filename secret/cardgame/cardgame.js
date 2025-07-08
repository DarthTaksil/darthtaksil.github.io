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
const claimCooldown = 24 * 60 * 60 * 1000; // 24 hours in ms
let currentUser = null;

// Event listeners
document.getElementById('login-google').addEventListener('click', () => login('google'));
document.getElementById('login-discord').addEventListener('click', () => login('discord'));
document.getElementById('logout').addEventListener('click', logout);
dailyButton.addEventListener('click', claimDailyPack);

// 🔁 Restore session on load
checkUserSession();

// 🎧 React to manual login/logout
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
  const { error } = await supabase.auth.signInWithOAuth({ provider });
  if (error) console.error('Login error:', error.message);
}

async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    currentUser = null;
    showLogin();
    console.log("User successfully signed out.");
  } catch (err) {
    console.error("Logout error:", err.message || err);
  }
}

async function checkUserSession(retry = 0) {
  try {
    const { data, error } = await supabase.auth.getSession();

    // Wait for Supabase to become ready (Firefox quirk)
    if (!data?.session && retry < 5) {
      console.warn("Waiting for session to be ready...");
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
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // User not found, create it
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      last_daily_claim: null,
    });

    if (insertError) {
      console.error('Failed to create user:', insertError);
    }
  } else if (error) {
    console.error('User fetch error:', error);
  }
}

// ------------------- UI CONTROL ------------------

function showLogin() {
  authUI.style.display = 'block';
  gameUI.style.display = 'none';
}

function showGame(user) {
  currentUser = user;
  userEmail.textContent = user.email || user.user_metadata.full_name || 'Player';
  authUI.style.display = 'none';
  gameUI.style.display = 'block';
  checkDailyStatus();
}

// --------------- DAILY PACK LOGIC ----------------

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
  const now = new Date().toISOString();
  const newCards = await getRandomCardPack();

  const { error } = await supabase
    .from('users')
    .update({ last_daily_claim: now })
    .eq('id', currentUser.id);

  if (error) {
    console.error('Failed to update daily claim:', error);
    return;
  }

  await giveCardsToUser(newCards);

  console.log("You got:");
  newCards.forEach(card => {
    console.log(`- ${card.name} [${card.rarity}]`);
  });

  checkDailyStatus();
}

// --------------- CARD LOGIC ----------------

async function getRandomCardPack() {
  const { data: cards, error } = await supabase.from('cards').select('*');

  if (error) {
    console.error('Card fetch error:', error);
    return [];
  }

  const byRarity = {
    Common: cards.filter(c => c.rarity === 'Common'),
    Uncommon: cards.filter(c => c.rarity === 'Uncommon'),
    Rare: cards.filter(c => c.rarity === 'Rare'),
    Legendary: cards.filter(c => c.rarity === 'Legendary'),
  };

  const weights = {
    Common: 70,
    Uncommon: 20,
    Rare: 8,
    Legendary: 2,
  };

  const result = [];

  for (let i = 0; i < 5; i++) {
    const rarity = pickWeightedRarity(weights);
    const options = byRarity[rarity];
    const card = options[Math.floor(Math.random() * options.length)];
    result.push(card);
  }

  return result;
}

function pickWeightedRarity(weights) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * totalWeight;

  for (const [rarity, weight] of entries) {
    if (rand < weight) return rarity;
    rand -= weight;
  }
  return 'Common';
}

async function giveCardsToUser(cards) {
  for (const card of cards) {
    const { data: existing, error } = await supabase
      .from('user_cards')
      .select('quantity')
      .eq('user_id', currentUser.id)
      .eq('card_id', card.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Fetch error:', error);
      continue;
    }

    if (existing) {
      await supabase
        .from('user_cards')
        .update({ quantity: existing.quantity + 1 })
        .eq('user_id', currentUser.id)
        .eq('card_id', card.id);
    } else {
      await supabase
        .from('user_cards')
        .insert({
          user_id: currentUser.id,
          card_id: card.id,
          quantity: 1
        });
    }
  }

  console.log("Cards saved to user inventory.");
}
