class CollectionSettings {
  hideEmptySets = false;
  isReadOnly = false;
}

class CardCollection {
  constructor(sets, repository, settings) {
    this._sets = sets;
    this._repository = repository;
    this._settings = settings;
  }

  static async build(repository, settings) {
    try {
      const response = await fetch(`${SiteSettings.rootUrl}/cardDatabase.json`);
      const databaseSets = await response.json();

      const sets = databaseSets.map((databaseSet) => {
        const cards = databaseSet.cards.map((card) => {
          const count = repository.get(databaseSet.code, card.number);
          return new Card(card.name, card.number, card.rarity, card.type, count);
        });
        return new Set(databaseSet.name, databaseSet.code, cards);
      });
      return new CardCollection(sets, repository, settings);
    } catch (error) {
      console.error('Error building card collection:', error);
      throw error;
    }
  }

  render() {
    const setsElement = document.querySelector('#sets');

    this._sets.forEach((set) => {

      if (this._settings.hideEmptySets && !set.hasAnyCard()) 
        return;

      const setElement = set.render(this._settings);
      setsElement.appendChild(setElement);

      setElement.addEventListener('cardCountUpdated', (event) => {
        this._repository.set(event.set.code, event.card.number, event.card.count);
      })
    });
  }
}

class Set {
  cards = [];
  name = '';
  code = '';

  constructor(name, code, cards) {
    this.name = name;
    this.code = code;
    this.cards = cards;
  }

  getSummary() {
    const regularCards = this.cards.filter((card) => card.rarity.startsWith('d'));
    const ownedCards = regularCards.filter((card) => card.count > 0);

    return {
      total: regularCards.length,
      owned: ownedCards.length,
    };
  }

  hasAnyCard() {
    return this.cards.filter((card) => card.count > 0).length > 0;
  }

  render(settings) {
    const setElement = document.createElement('div');
    setElement.classList.add('set');

    const setHeadingElement = document.createElement('div');
    setHeadingElement.classList.add('set-heading');
    setElement.appendChild(setHeadingElement);

    const setNameElement = document.createElement('h3');
    setNameElement.textContent = this.name;
    setHeadingElement.appendChild(setNameElement);

    const setSummaryElement = document.createElement('span');
    setHeadingElement.appendChild(setSummaryElement);
    this.updateSummaryText(setSummaryElement);

    const setCardsElement = document.createElement('div');
    setCardsElement.classList.add('set-cards');
    setElement.appendChild(setCardsElement);

    this.cards.forEach((card) => {
      const cardElement = card.render(settings);
      setCardsElement.appendChild(cardElement);

      cardElement.addEventListener('countUpdated', (card) => {
        this.updateSummaryText(setSummaryElement);

        const event = new CustomEvent("cardCountUpdated", {card: card, set: this});
        setElement.dispatchEvent(event);
      })
    });

    setNameElement.addEventListener('click', () => {
      setCardsElement.classList.toggle('hidden');
    });

    return setElement;
  }

  updateSummaryText(setSummaryElement) {
    const setSummary = this.getSummary();
    setSummaryElement.textContent = `${setSummary.owned}/${setSummary.total}`;
  }
}

class Card {
  name = '';
  number = 0;
  rarity = '';
  type = '';
  count = 0;

  constructor(name, number, rarity, type, count) {
    this.name = name;
    this.number = number;
    this.rarity = rarity;
    this.type = type;
    this.count = count;
  }

  render(settings) {
    const cardElement = document.createElement('button');
    cardElement.classList.add('card');
    cardElement.classList.add(`card-${CardMappings.type[this.type].toLowerCase()}`);
    cardElement.classList.add(`card-missing`);

    const nameElement = document.createElement('span');
    nameElement.classList.add('name');
    nameElement.textContent = this.name;

    const idElement = document.createElement('span');
    idElement.classList.add('id');
    idElement.textContent = `#${this.number.toString().padStart(3, '0')} ${CardMappings.rarity[this.rarity]}`;

    const countElement = document.createElement('button');
    countElement.classList.add('count');
    this.setCount(this.count, cardElement, countElement);

    cardElement.appendChild(nameElement);
    cardElement.appendChild(idElement);
    cardElement.appendChild(countElement);

    if (!settings.isReadOnly)
      this.configureCardCounter(cardElement, countElement);

    return cardElement;
  }

  configureCardCounter(cardElement, countElement) {
    countElement.addEventListener('click', (event) => {
      event.stopPropagation();

      if (this.count <= 0)
        return;

      this.setCount(this.count - 1, cardElement, countElement);
    });
  
    cardElement.addEventListener('click', () => {
  
      if (this.count >= 9)
        return;
  
      this.setCount(this.count + 1, cardElement, countElement);
    });
  }
  
  setCount(newCount, cardElement, countElement) {
    this.count = newCount;

    countElement.textContent = newCount.toString();

    if (newCount <= 0) {
      cardElement.classList.add('card-missing');
    } else {
      cardElement.classList.remove('card-missing');
    }

    const event = new CustomEvent("countUpdated", this);
    cardElement.dispatchEvent(event);
  }
}

class CardMappings {
  static rarity = {
    d1: '◆',
    d2: '◆◆',
    d3: '◆◆◆',
    d4: '◆◆◆◆',
    s1: '★',
    s2: '★★',
    s3: '★★★',
    c1: '♚',
  };
  
  static type = {
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
}

class CardCountRepository {
  _cards = {};

  constructor(cards) {
    if (cards)
      this._cards = cards;
  }

  get(setCode, cardNumber) {
    return this._cards[setCode] && this._cards[setCode][cardNumber] 
      ? this._cards[setCode][cardNumber] 
      : 0;
  }

  set(setCode, cardNumber, cardCount) {
    if (!this._cards[setCode]) {
      this._cards[setCode] = {};
    }

    if (this._cards[setCode][cardNumber]) {
      this._cards[setCode][cardNumber] = cardCount;
      if (this._cards[setCode][cardNumber] <= 0) {
        delete this._cards[setCode][cardNumber];
      }
    } else if (cardCount > 0) {
      this._cards[setCode][cardNumber] = cardCount;
    }
  }

  serialize() {
    return CardCountSerializer.serializeRoute(this._cards);
  }
}

class LocalCardCountRepository extends CardCountRepository {
  static #storageKey = 'pocketPokedex';

  constructor() {
    var cards = LocalCardCountRepository.#loadCardsFromStorage();
    super(cards);
  }

  set(set, cardNumber, cardCount) {
    super.set(set, cardNumber, cardCount);
    this.#saveCardsToStorage();
  }

  #saveCardsToStorage() {
    localStorage.setItem(LocalCardCountRepository.#storageKey, JSON.stringify(this._cards));
  }

  static #loadCardsFromStorage() {
    const storedData = localStorage.getItem(LocalCardCountRepository.#storageKey);
    if (storedData)
      return JSON.parse(storedData);

    return null;
  }
}

class RouteCardCountRepository extends CardCountRepository {
  constructor() {
    var serialized = window.location.search.slice(1);
    var cards = CardCountSerializer.deserializeRoute(serialized);
    super(cards);
  }
}

class CardCountSerializer {
  static serializeRoute(cardCollection) {
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

  static deserializeRoute(route) {
    const cardCollection = {};
    const sets = route.split('&');

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

class SiteSettings {
  static isLocal = false;
  static rootUrl = '';

  static init() {
    this.isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    this.rootUrl = this.isLocal 
      ? `${window.location.protocol}//${window.location.host}`
      : `${window.location.protocol}//${window.location.host}/PocketPokedex`;
  }
}

function configureShareButton(cardCountRepository) {
  const generateLinkButton = document.getElementById('generate-link');
  const copyLinkButton = document.getElementById('copy-link');
  const linkValue = document.getElementById('link-value');

  generateLinkButton.addEventListener('click', () => {
    const collectionSnapshot = cardCountRepository.serialize();
    const url = `${SiteSettings.rootUrl}/view?${collectionSnapshot}`;
    linkValue.value = url;
  });

  copyLinkButton.addEventListener('click', () => {
    const linkValueString = linkValue.value.toString();
    navigator.clipboard.writeText(linkValueString);
  });
}

SiteSettings.init();