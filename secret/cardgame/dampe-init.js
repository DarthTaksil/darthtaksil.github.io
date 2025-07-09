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

  document.getElementById("digBtn").addEventListener("click", async () => {
    if (isCooldown) return; // prevent spamming
    startCooldown(); // begin cooldown

    // Cooldown Circle 

    const cooldownDuration = 5000; // 5 seconds
    const cooldownCircle = document.querySelector('.cooldown-progress');
    const fullDash = 2 * Math.PI * 45; // same radius as SVG circle

    function startCooldown() {
        isCooldown = true;
        document.getElementById("digBtn").disabled = true;
        let start = Date.now();

    function update() {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, cooldownDuration - elapsed);
        const progress = remaining / cooldownDuration;

        cooldownCircle.style.strokeDashoffset = fullDash * progress;

        if (remaining > 0) {
            requestAnimationFrame(update);
        } else {
            isCooldown = false;
            document.getElementById("digBtn").disabled = false;
            cooldownCircle.style.strokeDashoffset = 0;
        }
    }

    requestAnimationFrame(update);
    }

    // Dig

    let resultText = "";
    const resultImg = new Image();

    const roll = Math.random();
    if (roll < 0.06) 
    {
        const card = await giveRandomCardToUser(currentUser.id);
        showCardModal(card);
        addCardToSidebar(card);
        return;
    }

     else if (roll < 0.50) 
    {
        resultText = "Green Rupee";
        resultImg.src = "/images/grnrup.png";
    }

     else if (roll < 0.80) 
    {
        resultText = "Blue Rupee";
        resultImg.src = "/images/blurup.png";
    }

     else 
    {
        resultText = "Red Rupee";
        resultImg.src = "/images/redrup.png";
    }

    const resultDiv = document.getElementById('dig-result');
    resultDiv.innerHTML = ""; // clear any previous content

    // Add image first
    resultImg.classList.add('result-img');
    resultDiv.appendChild(resultImg);

    // Then add text
    const textEl = document.createElement('div');
    textEl.textContent = resultText;
    resultDiv.appendChild(textEl);
    
    console.log("You got:", resultText);

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