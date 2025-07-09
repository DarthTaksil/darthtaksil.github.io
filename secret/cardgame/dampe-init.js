import { getCurrentUser } from './shared/auth.js';
import { giveRandomCardToUser } from './shared/cards.js';

let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "/secret/cardgame/index.html"; // Redirect to login
    return;
  }

  // Attach dig event
  document.getElementById("digBtn").addEventListener("click", async () => {
    const roll = Math.random();
    if (roll < 0.10) 
    {
        const card = await giveRandomCardToUser(currentUser.id);
        showCardModal(card);
        addCardToSidebar(card);
    }

     else if (roll < 0.50) 
    {
        resultText = "Green Rupee";
    }

     else if (roll < 0.80) 
    {
        resultText = "Blue Rupee";
    }

     else 
    {
        resultText = "Red Rupee";
    }

  });
});

// show card obtained
function showCardModal(card) {
  const modal = document.getElementById("daily-modal");
  const cardSlot = document.getElementById("modal-cards");
  cardSlot.innerHTML = ""; // clear old card

  const img = document.createElement("img");
  img.src = `/cards/${String(card.id).padStart(3, '0')}.png`;
  img.alt = card.name;
  cardSlot.appendChild(img);

  modal.classList.remove("hidden");
}

// After user is verified
function showUserInfo(user) {
  const meta = user.user_metadata || {};
  const username = meta.full_name || meta.name || meta.preferred_username || 'Player';
  document.getElementById('dampe-user-name').textContent = username;
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
});

function addCardToSidebar(card) {
  const list = document.getElementById('dampe-card-list');
  const item = document.createElement('li');

  const img = document.createElement('img');
  img.src = `/cards/${String(card.id).padStart(3, '0')}.png`;
  img.alt = card.name;

  const label = document.createElement('span');
  label.textContent = card.name;

  item.appendChild(img);
  item.appendChild(label);
  list.appendChild(item);
}


document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('daily-modal').classList.add('hidden');
});