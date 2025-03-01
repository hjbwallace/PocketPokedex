async function loadCards(cardCollection) {
  try {
    const response = await fetch('/cardDatabase.json');
    const data = await response.json();
    displayCards(data, cardCollection);
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

function displayCards(sets, cardCollection) {
  const setsElement = document.querySelector('#sets');

  sets.forEach((set) => {

    if (!cardCollection.showEmptySets && cardCollection.getSetCount(set.code) <= 0) 
      return;

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

      if (!cardCollection.isReadOnly)
        configureCardCounter(cardCollection, set.code, card.number, cardElement, countElement);

      setCardCount(cardCollection, set.code, card.number, cardElement, countElement);
    });
  });
}

function configureCardCounter(cardCollection, set, cardNumber, cardElement, countElement) {
  countElement.addEventListener('click', (event) => {
    event.stopPropagation();

    if (cardCollection.getCardCount(set, cardNumber) <= 0)
      return;

    cardCollection.removeCard(set, cardNumber);
    setCardCount(cardCollection, set, cardNumber, cardElement, countElement);
  });

  cardElement.addEventListener('click', () => {

    if (cardCollection.getCardCount(set, cardNumber) >= 9)
      return;

    cardCollection.addCard(set, cardNumber);
    setCardCount(cardCollection, set, cardNumber, cardElement, countElement);
  });
}

function setCardCount(cardCollection, set, cardNumber, cardElement, countElement)
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



class CardCollectionSerializer {
  static serialize(cardCollection) {
    const serialized = [];

    for (const set in cardCollection) {
      const cards = cardCollection[set];
      const cardStrings = [];

      if (!Object.keys(cards).length > 0) 
        continue;
  
      for (let i = 1; i <= Math.max(...Object.keys(cards)); i++) {
        const count = cards[i] || 0;
        cardStrings.push(`${count}`);
      }
  
      const setString = `${set}-${cardStrings.join('')}`;
      serialized.push(setString);
    }

    return serialized.join('&');
  }

  static deserialize(serialized) {
    const cardCollection = {};
    const sets = serialized.split('&');

    sets.forEach(set => {
      const [setName, cardCounts] = set.split('-');
      const cards = {};

      if (!cardCounts || cardCounts.length < 1)
        return;
      
      for (let i = 0; i < cardCounts.length; i++) {
        const cardNumber = i + 1;
        const count = parseInt(cardCounts[i]);

        if (count > 0) {
          cards[cardNumber] = count;
        }
      }

      cardCollection[setName] = cards;
    });

    return cardCollection;
  }
}

class CardCollection {
  _cards = {};

  isReadOnly;
  showEmptySets;

  constructor(cards, isReadOnly, showEmptySets) {
    if (cards)
      this._cards = cards;

    this.isReadOnly = isReadOnly;
    this.showEmptySets = showEmptySets;
  }

  getCardCount(set, number) {
    return this._cards[set] && this._cards[set][number] 
      ? this._cards[set][number] 
      : 0;
  }

  getSetCount(set) {
    return this._cards[set]
      ? Object.keys(this._cards[set]).length
      : 0;
  }

  serialize() {
    return CardCollectionSerializer.serialize(this._cards);
  }

  _updateCardCount(set, number, delta) {
    if (this.isReadOnly)
      return;
    
    if (!this._cards[set]) {
      this._cards[set] = {};
    }

    if (this._cards[set][number]) {
      this._cards[set][number] += delta;
      if (this._cards[set][number] <= 0) {
        delete this._cards[set][number];
      }
    } else if (delta > 0) {
      this._cards[set][number] = delta;
    }
  }
}

class LocalCardCollection extends CardCollection {
  static #storageKey = 'pocketPokedex';

  constructor() {
    var cards = LocalCardCollection.loadCardsFromStorage();
    super(cards, false, true);
  }

  static loadCardsFromStorage() {
    const storedData = localStorage.getItem(LocalCardCollection.#storageKey);
    if (storedData)
      return JSON.parse(storedData);

    return null;
  }

  addCard(set, number) { 
    this._updateCardCount(set, number, 1); 
    this.#saveCardsToStorage();
  }

  removeCard(set, number) { 
    this._updateCardCount(set, number, -1); 
    this.#saveCardsToStorage();
  }

  #saveCardsToStorage() {
    localStorage.setItem(LocalCardCollection.#storageKey, JSON.stringify(this._cards));
  }
}

class ViewCardCollection extends CardCollection {
  isReadOnly = true;
  showEmptySets = false;

  constructor() {
    var serialized = window.location.search.slice(1);
    var cards = CardCollectionSerializer.deserialize(serialized);
    super(cards, true, false);
  }
}

function configureShareButton() {
  const generateLinkButton = document.getElementById('generate-link');
  const linkValue = document.getElementById('link-value');
  const copyLinkButton = document.getElementById('copy-link');

  generateLinkButton.addEventListener('click', () => {
    const collectionSnapshot = localCardCollection.serialize();
    const url = `${window.location.protocol}//${window.location.host}/view?${collectionSnapshot}`;
    linkValue.value = url;
  });

  copyLinkButton.addEventListener('click', () => {
    navigator.clipboard.writeText(linkValue.value);
  });
}

const localCardCollection = new LocalCardCollection();
const viewCardCollection = new ViewCardCollection();