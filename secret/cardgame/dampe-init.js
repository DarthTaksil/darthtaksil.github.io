import { getCurrentUser } from './shared/auth.js';
import { giveRandomCardToUser } from './shared/cards.js';
import { supabase } from './shared/supabaseConfig.js';

window.supabaseClient = supabase;

let Rupees = 0;
let displayedRupees = 0;
let previousRupees = 0;

let currentUser = null;
let isCooldown = false;

const sfxGetItem = new Audio('./audio/getItem.ogg');
const sfxGetRupee = new Audio('./audio/getRupee.ogg');
const sfxRupeeChange = new Audio('./audio/getRupeeChange.ogg');
const sfxRupeeChangeDone = new Audio('./audio/getRupeeChangeDone.ogg');
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
        } else if (roll < 0.30) {
          resultText = "Red Rupee";
          resultImg.src = "/images/redrup.png";
          await rewardCoins(20);
        } else if (roll < 0.52) {
          resultText = "Blue Rupee";
          resultImg.src = "/images/blurup.png";
          await rewardCoins(5);
        } else {
          resultText = "Green Rupee";
          resultImg.src = "/images/grnrup.png";
          await rewardCoins(1);
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
  item.classList.add('flash-card');

  const img = document.createElement('img');
  img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
  img.alt = card.name;

  const label = document.createElement('span');
  label.textContent = card.name;

  item.appendChild(img);
  // item.appendChild(label); // Optional
  list.appendChild(item);

  return item; // return the new element
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
    sfxRupeeChangeDone.play(); // Done sound
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
  const finalCardId = card.id;
  const cardCount = 30;

  // Clear previous
  carousel.innerHTML = '';

  // Create inner container
  const inner = document.createElement('div');
  inner.className = 'carousel-inner';
  inner.style.display = 'flex';          // horizontal layout
  inner.style.position = 'absolute';
  inner.style.left = '0';                // reset position
  inner.style.transition = 'none';       // prevent default transition
  carousel.appendChild(inner);

  // Build spin list
  const spinCards = [];
  for (let i = 0; i < cardCount; i++) {
    const randomId = Math.floor(Math.random() * 180) + 1;
    spinCards.push(randomId);
  }
  spinCards.push(finalCardId); // put final card at end

  // Add images to carousel
  spinCards.forEach(id => {
    const img = document.createElement('img');
    img.src = `./cards/${String(id).padStart(3, '0')}.png`;
    img.alt = '';
    img.style.width = '120px';
    img.style.height = '180px';
    inner.appendChild(img);
  });

  // Show modal
  document.getElementById('modal-date').textContent = 'You dug up a card!';
  overlay.classList.remove('hidden');

  // Animate using requestAnimationFrame
  const totalSteps = spinCards.length - 1;
  const totalDistance = totalSteps * 120; // 120px per card width
  const duration = 2000; // in ms
  const startTime = performance.now();

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function animateSpin(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuad(progress);
    const position = -eased * totalDistance;

    inner.style.left = `${position}px`;

    if (progress < 1) {
      requestAnimationFrame(animateSpin);
    } else {

      const sidebarItem = addCardToSidebar(card); // store the returned element
      sidebarItem.scrollIntoView({ behavior: "smooth" });

      // Lock final card in place
      inner.style.left = `-${totalDistance}px`;

      // Add to sidebar
      addCardToSidebar(card);

      // Fade in close button
      const closeBtn = document.getElementById('modal-close');
      closeBtn.classList.add('show');

      document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('modal-close').classList.remove('show');
      });

      sfxGetItem.play(); // play get item sfx
    }
  }

  requestAnimationFrame(animateSpin);
}