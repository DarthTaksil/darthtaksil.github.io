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

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('daily-modal').classList.add('hidden');
});