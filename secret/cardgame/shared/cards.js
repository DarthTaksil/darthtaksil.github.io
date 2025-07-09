// /shared/cards.js
import { supabase } from './supabase.js';

export async function giveRandomCardToUser(userId) {
  const { data: cards } = await supabase.from('cards').select('*');

  const byRarity = {
    common: cards.filter(c => c.rarity === 'common'),
    uncommon: cards.filter(c => c.rarity === 'uncommon'),
    rare: cards.filter(c => c.rarity === 'rare'),
    legendary: cards.filter(c => c.rarity === 'legendary'),
  };

  const weights = { common: 70, uncommon: 20, rare: 8, legendary: 2 };

  function pickWeightedRarity() {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [rarity, weight] of Object.entries(weights)) {
      if (rand < weight) return rarity;
      rand -= weight;
    }
    return 'common';
  }

  const rarity = pickWeightedRarity();
  const options = byRarity[rarity];
  const card = options[Math.floor(Math.random() * options.length)];

  // Insert or update card
  const { data: existing } = await supabase
    .from('user_cards')
    .select('quantity')
    .eq('user_id', userId)
    .eq('card_id', card.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_cards')
      .update({ quantity: existing.quantity + 1 })
      .eq('user_id', userId)
      .eq('card_id', card.id);
  } else {
    await supabase
      .from('user_cards')
      .insert({ user_id: userId, card_id: card.id, quantity: 1 });
  }

  return card;
}

export function showCardModal(card) {
  const modal = document.getElementById('daily-modal');
  const modalCards = document.getElementById('modal-cards');
  const modalDate = document.getElementById('modal-date');

  // Show today's date
  const today = new Date();
  modalDate.textContent = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  modalCards.innerHTML = '';

  const img = document.createElement('img');
  const paddedId = String(card.id).padStart(3, '0');
  img.src = `./cards/${paddedId}.png`;
  img.alt = card.name;
  modalCards.appendChild(img);

  modal.classList.remove('hidden');
}
