import { getCurrentUser } from './shared/auth.js';
import { giveRandomCardToUser } from './shared/cards.js';

let currentUser = null;
let isCooldown = false;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "/secret/cardgame/index.html"; // Redirect to login
    return;
  }

   showUserInfo(currentUser);

    const cooldownDuration = 5000; // 5 seconds
    let isCooldown = false;

    document.getElementById("digBtn").addEventListener("click", async () => {

    if (isCooldown) return;
    isCooldown = true;

    const digBtn = document.getElementById("digBtn");
    const fill = digBtn.querySelector(".dig-fill");

    // Start cooldown visual
    digBtn.disabled = true;
    fill.style.transition = "none";
    fill.style.width = "0%";
    requestAnimationFrame(() => {
        fill.style.transition = `width ${cooldownDuration}ms linear`;
        fill.style.width = "100%";
    });

    try {
        let resultText = "";
        const resultImg = new Image();
        const roll = Math.random();

        if (roll < 0.06) {
        const card = await giveRandomCardToUser(currentUser.id);
        showCardModal(card);
        addCardToSidebar(card);
        resultText = "You found a card!";
        } else if (roll < 0.50) {
        resultText = "Green Rupee";
        resultImg.src = "/images/grnrup.png";
        } else if (roll < 0.80) {
        resultText = "Blue Rupee";
        resultImg.src = "/images/blurup.png";
        } else {
        resultText = "Red Rupee";
        resultImg.src = "/images/redrup.png";
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
        }, 4100);
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

  const img = document.createElement('img');
  img.src = `./cards/${String(card.id).padStart(3, '0')}.png`;
  img.alt = card.name;

  const label = document.createElement('span');
  label.textContent = card.name;

  item.appendChild(img);
//  item.appendChild(label); //
  list.appendChild(item);
}