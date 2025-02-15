function initialise() {
  loadCards();
}

async function loadCards() {
  try {
    const response = await fetch('cardDatabase.json');
    const data = await response.json();
    displayCards(data);
    configureCards();
  } catch (error) {
    console.error('Error loading card data:', error);
  }
}

const rarityMap = {
  d1: '◆',
  d2: '◆◆',
  d3: '◆◆◆',
  d4: '◆◆◆◆',
  s1: '★',
  s2: '★★',
  s3: '★★★',
  c1: '♚',
};

const typeMap = {
  0: 'Colorless',
  1: 'Grass',
  2: 'Fire',
  3: 'Water',
  4: 'Lightning',
  5: 'Fighting',
  6: 'Psychic',
  7: 'Darkness',
  8: 'Metal',
  9: 'Dragon',
  10: 'Supporter',
  11: 'Item',
  12: 'Tool'
}

function displayCards(sets) {
  const setsElement = document.querySelector('#sets');

  sets.forEach((set) => {
    const setElement = document.createElement('div');
    setElement.classList.add('set');
    setsElement.appendChild(setElement);

    const setHeading = document.createElement('h3');
    setHeading.textContent = set.name;
    setElement.appendChild(setHeading);

    const setCardsElement = document.createElement('div');
    setCardsElement.classList.add('set-cards');
    setElement.appendChild(setCardsElement);

    set.cards.forEach((card) => {
      const cardElement = document.createElement('button');
      cardElement.classList.add('card');
      cardElement.classList.add(`card-${typeMap[card.type].toLowerCase()}`);
      cardElement.classList.add(`card-missing`);

      const nameElement = document.createElement('span');
      nameElement.classList.add('name');
      nameElement.textContent = card.name;

      const idElement = document.createElement('span');
      idElement.classList.add('id');
      idElement.textContent = `#${card.number.toString().padStart(3, '0')} ${rarityMap[card.rarity]}`;

      const countElement = document.createElement('span');
      countElement.classList.add('count');
      countElement.textContent = '0';

      cardElement.appendChild(nameElement);
      cardElement.appendChild(idElement);
      cardElement.appendChild(countElement);

      setCardsElement.appendChild(cardElement);
    });
  });
}

function configureCards() {
  const cards = document.querySelectorAll('.card');
  cards.forEach((card) => {
    card.addEventListener('click', () => updateCardCount(card, 1));

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault(); // prevent the default context menu from appearing
      updateCardCount(card, -1);
    });

    function updateCardCount(card, increment) {
      const countElement = card.querySelector('.count');
      const currentCount = parseInt(countElement.textContent);
      const newCount = currentCount + increment;

      if (newCount > 99 || newCount < 0)
        return;
      
      countElement.textContent = newCount.toString();

      if (newCount === 0) {
        card.classList.add('card-missing');
      } else {
        card.classList.remove('card-missing');
      }
    }
  });
}

window.onload = initialise;