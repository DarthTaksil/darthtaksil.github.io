import { getCurrentUser } from './shared/auth.js';
import { giveRandomCardToUser } from './shared/cards.js';
import { supabase } from './shared/supabaseConfig.js';

window.supabaseClient = supabase;

let Rupees = 0;
let displayedRupees = 0;
let previousRupees = 0;

let currentUser = null;
let isCooldown = false;

const sfxGetItem = new Audio('/audio/getItem.wav');
const sfxGetRupee = new Audio('/audio/getRupee.wav');
const sfxRupeeChange = new Audio('/audio/getRupeeChange.wav');
const sfxRupeeChangeDone = new Audio('/audio/getRupeeChangeDone.wav');
sfxRupeeChange.loop = true;  // used while wallet is changing amounts

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "/secret/cardgame/index.html"; // Redirect to login
    return;
  }

  showUserInfo(currentUser);
  await loadWalletBalance(currentUser.id);

  // Fetch wallet and start animation
  const { data: userData, error } = await supabase
    .from('users')
    .select('wallet')
    .eq('id', currentUser.id)
    .single();

  if (!error && userData) {
    Rupees = userData.wallet ?? 0;
    displayedRupees = Rupees;
    previousRupees = Rupees;
    document.getElementById("rupeeAmount").textContent = Rupees;
  }
  animateRupeeCount();

  const cooldownDuration = 3000; // cooldown in milliseconds
  let isCooldown = false;

  // --------------------------  DIG  --------------------

  document.getElementById("digBtn").addEventListener("click", async () => {

    if (isCooldown) return;
    isCooldown = true;

    const digBanner = document.getElementById("dig-banner");
    if (digBanner) {
      digBanner.classList.add("fade-out");
      setTimeout(() => {
        digBanner.remove();
      }, 1000); // match CSS transition duration
    }

    const cost = 10; // Cost for Digging

    const { data: userData, error } = await supabase
      .from('users')
      .select('wallet')
      .eq('id', currentUser.id)
      .single();
    
    if ((userData.wallet ?? 0) < cost) {
      alert("You need more Clint Coin to dig!");
      return;
    }

    await supabase
      .from('users')
      .update({ wallet: userData.wallet - cost })
      .eq('id', currentUser.id);

      Rupees = userData.wallet - cost;

    const digBtn = document.getElementById("digBtn");
    const fill = digBtn.querySelector(".dig-fill");

    // Start cooldown visual
    digBtn.disabled = true;
    fill.style.transition = "none";
    fill.style.width = "0%";
    requestAnimationFrame(() => {
        fill.style.transition = `width ${cooldownDuration}ms ease-in`;
        fill.style.width = "100%";
    });

    try {
        let resultText = "";
        const resultImg = new Image();
        const roll = Math.random();

        if (roll < 0.09) {
          const card = await giveRandomCardToUser(currentUser.id);
          showCardCarousel(card);
          resultText = "You found a card!";
        } else if (roll < 0.13) {
          resultText = "Purple Rupee";
          resultImg.src = "/images/purprup.png";
          await rewardCoins(50);
          sfxGetRupee.play();
        } else if (roll < 0.30) {
          resultText = "Red Rupee";
          resultImg.src = "/images/redrup.png";
          await rewardCoins(20);
          sfxGetRupee.play();
        } else if (roll < 0.52) {
          resultText = "Blue Rupee";
          resultImg.src = "/images/blurup.png";
          await rewardCoins(5);
          sfxGetRupee.play();
        } else {
          resultText = "Green Rupee";
          resultImg.src = "/images/grnrup.png";
          await rewardCoins(1);
          sfxGetRupee.play();
        }

        const resultDiv = document.getElementById('dig-result');
        resultDiv.innerHTML = "";

        if (resultImg.src) {
        resultImg.classList.add('result-img');
        resultDiv.appendChild(resultImg);
        }

        const textEl = document.createElement('div');
        textEl.textContent = resultText;
        resultDiv.appendChild(textEl);
    } finally {

      setTimeout(() => {
          fill.style.transition = "none";
          fill.style.width = "0%";
          digBtn.disabled = false;
          isCooldown = false;

          // Flash the Dig button
          digBtn.classList.add('flash');
          setTimeout(() => digBtn.classList.remove('flash'), 600);
      }, cooldownDuration);

      // Start fade-out on result
      const resultDiv = document.getElementById('dig-result');
      resultDiv.classList.add('fade-out');
      setTimeout(() => {
          resultDiv.classList.add('hide');
      }, 100); // Slight delay so transition applies

      // Reset result after fade
      setTimeout(() => {
          resultDiv.innerHTML = "";
          resultDiv.classList.remove('fade-out', 'hide');
      }, 2000);
    }

  });
});

// show card obtained
function showCardModal(card) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('daily-modal');
  const modalCards = document.getElementById('modal-cards');
  const modalDate = document.getElementById('modal-date');

  modalDate.textContent = 'You dug up a card!';
  modalCards.innerHTML = '';

  const img = document.createElement('img');
  img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
  img.alt = card.name;
  modalCards.appendChild(img);

  overlay.classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});

// After user is verified
function showUserInfo(user) {
  const meta = user.user_metadata || {};
  const username = meta.full_name || meta.name || meta.preferred_username || 'Player';
  document.getElementById('dampe-user-name').textContent = username;
}

function addCardToSidebar(card) {
  const list = document.getElementById('dampe-card-list');
  const item = document.createElement('li');
  const newSidebarItem = addCardToSidebar(card);
  newSidebarItem.classList.add('flash-card');

  const img = document.createElement('img');
  img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
  img.alt = card.name;

  const label = document.createElement('span');
  label.textContent = card.name;

  item.appendChild(img);
//  item.appendChild(label); //
  list.appendChild(item);
}

async function rewardCoins(amount) {
  const { data: userData, error } = await supabase
    .from('users')
    .select('wallet')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    console.error('Error fetching wallet:', error);
    return;
  }

  const newWallet = (userData.wallet ?? 0) + amount;

  const { error: updateError } = await supabase
    .from('users')
    .update({ wallet: newWallet })
    .eq('id', currentUser.id);

  if (updateError) {
    console.error('Error updating wallet:', updateError);
  } else {
    console.log(`+${amount} Clint Coin awarded!`);
    Rupees = newWallet; // Update target amount
  }
}

function animateRupeeCount() {
  const isAnimating = displayedRupees !== Rupees;

  if (isAnimating && sfxRupeeChange.paused) {
    sfxRupeeChange.play(); // Start loop
  }

  if (!isAnimating && !sfxRupeeChange.paused) {
    sfxRupeeChange.pause();
    sfxRupeeChange.currentTime = 0;
    sfxRupeeChangeDone.play(); // 🎵 Done sound
  }

  if (isAnimating) {
    displayedRupees += (Rupees - displayedRupees) * 0.1;
    if (Math.abs(Rupees - displayedRupees) < 0.5) {
      displayedRupees = Rupees;
    }

    const rounded = Math.round(displayedRupees);
    document.getElementById("rupeeAmount").textContent = rounded;

    if (rounded !== previousRupees) {
      const counterEl = document.getElementById("rupeeCounter");

      if (rounded > previousRupees) {
        counterEl.classList.add("flash-gain");
        setTimeout(() => counterEl.classList.remove("flash-gain"), 300);
      } else if (rounded < previousRupees) {
        counterEl.classList.add("flash-loss");
        setTimeout(() => counterEl.classList.remove("flash-loss"), 300);
      }

      previousRupees = rounded;
    }
  }

  requestAnimationFrame(animateRupeeCount);
}

async function loadWalletBalance(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('wallet')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to load wallet balance:', error);
    return;
  }

  const walletSpan = document.getElementById('rupeeAmount');
  walletSpan.textContent = data.wallet ?? 0;
}



// ----------- CARD CAROUSEL ----------

async function showCardCarousel(card) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('daily-modal');
  const carousel = document.getElementById('card-carousel');
  const cardCount = 30; // how many random cards to show while spinning
  const finalCardId = card.id;

  // Clear previous
  carousel.innerHTML = '';

  // Create inner container
  const inner = document.createElement('div');
  inner.className = 'carousel-inner';
  carousel.appendChild(inner);

  // Build fake spin list
  const spinCards = [];
  for (let i = 0; i < cardCount; i++) {
    const randomId = Math.floor(Math.random() * 180) + 1;
    spinCards.push(randomId);
  }

  // Add final card to end
  spinCards.push(finalCardId);

  // Add images to inner
  spinCards.forEach(id => {
    const img = document.createElement('img');
    img.src = `./cards/${String(id).padStart(3, '0')}.png`;
    img.alt = '';
    inner.appendChild(img);
  });

  // Append to modal and show
  document.getElementById('modal-date').textContent = 'You dug up a card!';
  overlay.classList.remove('hidden');

  // Animate spin (simulate scroll down)
  let currentIndex = 0;
  const totalSteps = spinCards.length - 1;
  let interval = 50;

  const spin = setInterval(() => {
    if (currentIndex < totalSteps) {
      inner.style.top = `-${currentIndex * 180}px`; // each card = 180px tall
      currentIndex++;
      interval += 10; // slow down
    } else {
      clearInterval(spin);
      // Final positioning
      inner.style.top = `-${totalSteps * 180}px`;
      sfxGetItem.play();
      addCardToSidebar(card);
    }
  }, interval);
}