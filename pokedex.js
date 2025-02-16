function initialise() {
  loadCards();
}

async function loadCards() {
  try {
    const response = await fetch('cardDatabase.json');
    const data = await response.json();
    displayCards(data);
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

      const countElement = document.createElement('button');
      countElement.classList.add('count');

      cardElement.appendChild(nameElement);
      cardElement.appendChild(idElement);
      cardElement.appendChild(countElement);

      setCardsElement.appendChild(cardElement);

      configureCardCounter(set.code, card.number, cardElement, countElement);
      setCardCount(set.code, card.number, cardElement, countElement);
    });
  });
}

function configureCardCounter(set, cardNumber, cardElement, countElement) {
  countElement.addEventListener('click', (event) => {
    event.stopPropagation();
    cardCollection.removeCard(set, cardNumber);
    setCardCount(set, cardNumber, cardElement, countElement);
  });

  cardElement.addEventListener('click', () => {
    cardCollection.addCard(set, cardNumber);
    setCardCount(set, cardNumber, cardElement, countElement);
  });
}

function setCardCount(set, cardNumber, cardElement, countElement)
{
  var cardCount = cardCollection.getCardCount(set, cardNumber);
  console.log('Card count is ' + cardCount);
  countElement.textContent = cardCount.toString();

  if (cardCount <= 0) {
    cardElement.classList.add('card-missing');
  } else {
    cardElement.classList.remove('card-missing');
  }
}

class CardCollection {
  #storageKey = 'pocketPokedex';
  #cards = {};

  constructor() {
    this.#load();
  }

  #load() {
    const storedData = localStorage.getItem(this.#storageKey);
    if (storedData) {
      this.#cards = JSON.parse(storedData);
    }
  }

  #save() {
    localStorage.setItem(this.#storageKey, JSON.stringify(this.#cards));
  }

  getCardCount(set, number) {
    return this.#cards[set] && this.#cards[set][number] 
      ? this.#cards[set][number] 
      : 0;
  }

  addCard(set, number) { this.#updateCardCount(set, number, 1); }

  removeCard(set, number) { this.#updateCardCount(set, number, -1); }

  #updateCardCount(set, number, delta) {
    if (!this.#cards[set]) {
      this.#cards[set] = {};
    }

    if (this.#cards[set][number]) {
      this.#cards[set][number] += delta;
      if (this.#cards[set][number] <= 0) {
        delete this.#cards[set][number];
      }
    } else if (delta > 0) {
      this.#cards[set][number] = delta;
    }

    this.#save();
  }
}

window.onload = initialise;
const cardCollection = new CardCollection();