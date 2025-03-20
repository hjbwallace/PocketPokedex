class CollectionSettings {
  hideEmptySets = false;
  isReadOnly = false;
}

class CardCollection {
  constructor(sets, repository, settings, filter) {
    this._sets = sets;
    this._repository = repository;
    this._settings = settings;
    this._filter = filter;
  }

  static async build(repository, settings, filter) {
    try {
      const response = await fetch(`${SiteSettings.rootUrl}/cardDatabase.json`);
      const databaseSets = await response.json();

      const sets = databaseSets.map((databaseSet) => {
        const cards = databaseSet.cards.map((databaseCard) => {
          const count = repository.get(databaseSet.code, databaseCard.number);
          const boosters = databaseCard.boosters.split("").map(x => databaseSet.boosters[Number(x)]);
          const card = new Card(databaseCard.name, databaseCard.number, databaseCard.rarity, databaseCard.type, count, boosters);
          card.setVisibility(filter);
          return card;
        });
        return new Set(databaseSet.name, databaseSet.code, Date.parse(databaseSet.releaseDate), cards, databaseSet.boosters);
      });
      return new CardCollection(sets, repository, settings, filter);
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
        this._repository.set(event.detail.set.code, event.detail.card.number, event.detail.card.count);
      })
    });
  }

  getSetNavigationDetails() {
    return this._sets.map((set) => ({ id: set.id, name: set.name }));
  }
}

class Set {
  id = '';
  name = '';
  code = '';
  releaseDate = new Date();
  cards = [];
  boosters = [];

  constructor(name, code, releaseDate, cards, boosters) {
    this.id = `set-${code}`;
    this.name = name;
    this.code = code;
    this.releaseDate = releaseDate;
    this.cards = cards;
    this.boosters = boosters;
  }

  getSummary() {
    const regularCards = this.cards.filter((card) => card.rarity.startsWith('d'));
    const ownedCards = regularCards.filter((card) => card.count > 0);

    return {
      total: regularCards.length,
      owned: ownedCards.length,
    };
  }

  getBoosterSummary() {
    const regularCards = this.cards.filter((card) => card.rarity.startsWith('d'));

    return this.boosters.map((booster) => {
      return {
        name: booster,
        total: regularCards.filter((card) => card.boosters.includes(booster)).length,
        owned: regularCards.filter((card) => card.boosters.includes(booster) && card.count > 0).length
      }
    })
  }

  hasAnyCard() {
    return this.cards.filter((card) => card.count > 0).length > 0;
  }

  render(settings) {
    const setElement = document.createElement('div');
    setElement.classList.add('set');
    setElement.id = `set-${this.code}`;

    const setHeadingElement = document.createElement('div');
    setHeadingElement.classList.add('set-heading');
    setElement.appendChild(setHeadingElement);

    const setNameElement = document.createElement('h3');
    setNameElement.textContent = this.name;
    setHeadingElement.appendChild(setNameElement);

    const setSummaryElement = document.createElement('span');
    setHeadingElement.appendChild(setSummaryElement);
    this.updateSetSummaryText(setSummaryElement);

    const boosterSummary = this.getBoosterSummary();

    if (boosterSummary.length > 1) {
      const boosterListElement = document.createElement('ul');
      boosterListElement.classList.add('set-boosters');

      boosterSummary.forEach((booster) => {
        const boosterElement = document.createElement('li');
        boosterElement.id = `booster-${booster.name}`;
        this.updateBoosterSummaryHtml(boosterElement, booster);
        boosterListElement.appendChild(boosterElement);
      });

      setElement.appendChild(boosterListElement);
    }

    const setCardsElement = document.createElement('div');
    setCardsElement.classList.add('set-cards');
    setElement.appendChild(setCardsElement);

    this.cards.forEach((card) => {
      const cardElement = card.render(settings);

      if (!cardElement)
        return;

      setCardsElement.appendChild(cardElement);

      cardElement.addEventListener('countUpdated', (cardEvent) => {
        this.updateSetSummaryText(setSummaryElement);
        this.updateBoosterSummaryText();

        const setEvent = new CustomEvent("cardCountUpdated", { detail: {card: cardEvent.detail, set: this} });
        setElement.dispatchEvent(setEvent);
      })
    });

    setNameElement.addEventListener('click', () => {
      setCardsElement.classList.toggle('hidden');
    });

    return setElement;
  }

  updateSetSummaryText(setSummaryElement) {
    const setSummary = this.getSummary();
    setSummaryElement.textContent = `${setSummary.owned}/${setSummary.total}`;
  }

  updateBoosterSummaryText() {
    const boosterSummary = this.getBoosterSummary();
    
    if (boosterSummary.length > 1) {
      boosterSummary.forEach((booster) => {
        const element = document.getElementById(`booster-${booster.name}`);
        this.updateBoosterSummaryHtml(element, booster);
      })
    }
  }

  updateBoosterSummaryHtml(boosterElement, booster) {
    boosterElement.innerHTML = `<strong>${booster.name}</strong> ${booster.owned}/${booster.total}`;
  }
}

class Card {
  name = '';
  number = 0;
  rarity = '';
  type = '';
  count = 0;
  boosters = [];

  constructor(name, number, rarity, type, count, boosters) {
    this.name = name;
    this.number = number;
    this.rarity = rarity;
    this.type = type;
    this.count = count;
    this.boosters = boosters;
    this.isVisible = false;
  }

  setVisibility(filter) {
    this.isVisible = filter.appliesTo(this);
  }

  render(settings) {
    if (!this.isVisible)
      return null;

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

    const event = new CustomEvent("countUpdated", { detail: this });
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

class CardFilter {
  static fromRoute(route) {
    const filter = new CardFilter();

    const params = new URLSearchParams(route);
    filter._query = params.get('q') || '';
    filter._status = params.get('status') || 'all';
    
    return filter;
  }

  appliesTo(card) {
    return card
      && this.checkQuery(card)
      && this.checkStatus(card);
  }

  checkQuery(card) {
    return !this._query || card.name.toLowerCase().includes(this._query.toLowerCase());
  }

  checkStatus(card) {
    switch (this._status) {
      case 'owned':
        return card.count >= 1;
      case 'duplicates':
        return card.count >= 2;
      case 'missing':
        return card.count === 0;
      default:
        return true;
    }
  }

  render() {
    this.setInputValues();

    document.getElementById('filter-reset').addEventListener('click', () => {
      this.reset();
      this.setInputValues();
    });
  }

  setInputValues() {
    document.getElementById('filter-query').value = this._query ?? '';
    document.getElementById('filter-status').value = this._status ?? 'all';
  }

  reset() {
    this._query = '';
    this._status = 'all';
  }
}

class NavBar {
  static render(cardCollection) {
    this.#renderSetNavigation(cardCollection);
    this.#configureToggle();
  }

  static #renderSetNavigation(cardCollection) {
    var setDetails = cardCollection.getSetNavigationDetails();
    var collectionSetsElement = document.getElementById("collection-sets");

    setDetails.forEach(setDetails => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `<a href="#${setDetails.id}">${setDetails.name}</a>`;
      collectionSetsElement.appendChild(listItem);
    });
  }

  static #configureToggle() {
    var navbarElement = document.getElementById("navbar");
    var navbarToggleElement = document.getElementById("navbar-toggle");

    navbarToggleElement.addEventListener('click', () => {
      if (navbarElement.className === "navbar") {
        navbarElement.className += " responsive";
      } else {
        navbarElement.className = "navbar";
      }
    });
  }
}

SiteSettings.init();