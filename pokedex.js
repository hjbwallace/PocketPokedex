class CollectionSettings {
  hideEmptySets = false;
  hideSetStatistics = false;
  isReadOnly = false;

  constructor() {
    this.hideSetStatistics = window.location.search.indexOf('&hideSetStatistics') !== -1;
  }
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

      const sets = databaseSets.reverse().map((databaseSet) => {
        const setBoosters = databaseSet.boosters.map((booster) => {
          const boosterType = databaseSet.cards.find(card => card.name.startsWith(booster))?.type;
          return new Booster(booster, booster[0], boosterType);
        });

        const setCards = databaseSet.cards.map((databaseCard) => {
          const count = repository.get(databaseSet.code, databaseCard.number);
          const boosters = databaseCard.boosters.split("").map(x => setBoosters[Number(x)]);
          const card = new Card(databaseCard.name, databaseCard.number, databaseCard.rarity, databaseCard.type, count, databaseSet.code, boosters);
          card.setVisibility(filter);
          return card;
        });
        return new Set(databaseSet.name, databaseSet.code, Date.parse(databaseSet.releaseDate), setCards, setBoosters);
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

      if (set.cards.filter((card) => card.isVisible).length === 0)
        return;

      const setElement = set.render(this._settings);

      setsElement.appendChild(setElement);

      setElement.addEventListener('cardCountUpdated', (event) => {
        this._repository.set(event.detail.set.code, event.detail.card.number, event.detail.card.count);
      })
    });
  }

  getSetDetails() {
    return this._sets.map((set) => ({ id: set.id, name: set.name, code: set.code }));
  }

  getBoosterDetails() {
    return this._sets.flatMap((set) => set.boosters.map((booster) => ({ name: booster.name, set: set.name })));
  }
}

class Booster {
  static TOTAL = new Booster("Total", "T", "Total");

  code = '';
  name = '';
  type = '';

  constructor(name, code, type) {
    this.name = name;
    this.code = code;
    this.type = type;
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

  getSetSummary() {
    const setBoosters = this.boosters.length > 1
      ? [...this.boosters, Booster.TOTAL]
      : [...this.boosters];

    return setBoosters.map((booster) => {
      const boosterCards = this.cards.filter((card) => card.boosters.some(booster => booster.name === booster.name) || booster.name === Booster.TOTAL.name);
      return this.getCardCollectionSummary(booster, boosterCards);
    })
  }

  getCardCollectionSummary(booster, cards) {
    return {
      name: booster.name,
      regular: new Quantity(
        cards.filter((card) => card.rarity.startsWith('d') && card.count > 0).length,
        cards.filter((card) => card.rarity.startsWith('d')).length),
      special: new Quantity(
        cards.filter((card) => !card.rarity.startsWith('d') && card.count > 0).length,
        cards.filter((card) => !card.rarity.startsWith('d')).length),
      total: new Quantity(
        cards.filter((card) => card.count > 0).length,
        cards.length),
      d1: new Quantity(
        cards.filter((card) => card.rarity === 'd1' && card.count > 0).length,
        cards.filter((card) => card.rarity === 'd1').length),
      d2: new Quantity(
        cards.filter((card) => card.rarity === 'd2' && card.count > 0).length,
        cards.filter((card) => card.rarity === 'd2').length),
      d3: new Quantity(
        cards.filter((card) => card.rarity === 'd3' && card.count > 0).length,
        cards.filter((card) => card.rarity === 'd3').length),
      d4: new Quantity(
        cards.filter((card) => card.rarity === 'd4' && card.count > 0).length,
        cards.filter((card) => card.rarity === 'd4').length),
    };
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

    const tableElement = this.renderTable();

    if (settings.hideSetStatistics) {
      tableElement.classList.add('hidden');
    }

    setElement.appendChild(tableElement);

    const setCardsElement = document.createElement('div');
    setCardsElement.classList.add('set-cards');
    setElement.appendChild(setCardsElement);

    this.cards.forEach((card) => {
      const cardElement = card.render(settings, this.boosters);

      if (!cardElement)
        return;

      setCardsElement.appendChild(cardElement);

      cardElement.addEventListener('countUpdated', (cardEvent) => {
        this.updateSetSummaryText(setSummaryElement);
        this.updateTable();

        const setEvent = new CustomEvent("cardCountUpdated", { detail: {card: cardEvent.detail, set: this} });
        setElement.dispatchEvent(setEvent);
      })
    });

    setNameElement.addEventListener('click', () => {
      setCardsElement.classList.toggle('hidden');
    });

    return setElement;
  }

  renderTable() {

    const tableWrapperElement = document.createElement('div');
    tableWrapperElement.classList.add('set-stats-table');

    const tableElement = document.createElement('table');

    // Build the header
    const tableHeaderElement = document.createElement('thead');
    tableHeaderElement.innerHTML = `
<tr>
  <th>Booster</th>
  <th>Total</th>
  <th>Regular</th>
  <th>Secret</th>
  <th>◆</th>
  <th>◆◆</th>
  <th>◆◆◆</th>
  <th>◆◆◆◆</th>
</tr>`;

    tableElement.appendChild(tableHeaderElement);

    // Add the data
    const tableBodyElement = document.createElement('tbody');
    const summary = this.getSetSummary();
    summary
      .filter((booster) => booster.name !== "Total")
      .forEach((booster) => {
        let boosterRowElement = this.renderTableRow(booster);
        tableBodyElement.appendChild(boosterRowElement);
      });

    tableElement.appendChild(tableBodyElement);

    const summaryTotal = summary.find((booster) => booster.name === "Total");

    if (summaryTotal) {
      const tableFooterElement = document.createElement('tfoot');
      let boosterRowElement = this.renderTableRow(summaryTotal);
      tableFooterElement.appendChild(boosterRowElement);
      tableElement.appendChild(tableFooterElement);
    }

    tableWrapperElement.appendChild(tableElement);
    return tableWrapperElement;
  }

  renderTableRow(booster) {
    const boosterRowElement = document.createElement('tr');
    boosterRowElement.id = `${this.id}-${booster.name}-stats`;
    boosterRowElement.innerHTML = `
<td>${booster.name}</td>
<td>${booster.total.current}/${booster.total.total}</td>
<td>${booster.regular.current}/${booster.regular.total}</td>
<td>${booster.special.current}/${booster.special.total}</td>
<td>${booster.d1.current}/${booster.d1.total}</td>
<td>${booster.d2.current}/${booster.d2.total}</td>
<td>${booster.d3.current}/${booster.d3.total}</td>
<td>${booster.d4.current}/${booster.d4.total}</td>`;

    return boosterRowElement;
  }

  updateTable() {
    const summary = this.getSetSummary();
    summary.forEach((booster) => {
      const boosterRowElement = document.getElementById(`${this.id}-${booster.name}-stats`);
      boosterRowElement.innerHTML = `
<td>${booster.name}</td>
<td>${booster.total.current}/${booster.total.total}</td>
<td>${booster.regular.current}/${booster.regular.total}</td>
<td>${booster.special.current}/${booster.special.total}</td>
<td>${booster.d1.current}/${booster.d1.total}</td>
<td>${booster.d2.current}/${booster.d2.total}</td>
<td>${booster.d3.current}/${booster.d3.total}</td>
<td>${booster.d4.current}/${booster.d4.total}</td>`;
    });
  }

  updateSetSummaryText(setSummaryElement) {
    const setSummary = this.getSummary();
    setSummaryElement.textContent = `${setSummary.owned}/${setSummary.total}`;
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
  set = '';
  boosters = [];

  constructor(name, number, rarity, type, count, set, boosters) {
    this.name = name;
    this.number = number;
    this.rarity = rarity;
    this.type = type;
    this.count = count;
    this.set = set;
    this.boosters = boosters;
    this.isVisible = false;
  }

  setVisibility(filter) {
    this.isVisible = filter.appliesTo(this);
  }

  render(settings, setBoosters) {
    if (!this.isVisible)
      return null;

    const cardElement = document.createElement('button');
    cardElement.classList.add('card');
    cardElement.classList.add(`card-${CardMappings.type[this.type].toLowerCase()}`);
    cardElement.classList.add(`card-missing`);

    if (!this.rarity.startsWith('d'))
      cardElement.classList.add('secret');

    if (setBoosters.length > 1 && this.boosters.length === 1) {
      const cardBooster = this.boosters[0];
      const boosterElement = document.createElement('span');
      boosterElement.classList.add('booster');
      boosterElement.classList.add(`card-${CardMappings.type[cardBooster.type ?? 0].toLowerCase()}`)
      boosterElement.textContent = cardBooster.code;
      cardElement.appendChild(boosterElement);
    }

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

class Quantity {
  current = 0;
  total = 0;
  percent = 0;

  constructor(current, total) {
    this.update(current, total);
  }

  update(current, total) {
    this.current = current;
    this.total = total;
    this.percent = (this.current / this.total) * 100;
  }

  render(hostElement) {
    hostElement.innerHTML = `${this.current}/${this.total}`;
  }
}

class CardCountRepository {
  constructor(cards, updates) {
    this._cards = cards ?? {};
    this._updates = updates ?? {};
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

    this._updates[setCode] = new Date().toISOString();
  }

  serializeRoute() {
    return CardCountSerializer.serializeRoute(this._cards);
  }
}

class LocalCardCountRepository extends CardCountRepository {
  static #storageKey = 'pocketPokedex';

  constructor() {
    const content = LocalCardCountRepository.#loadFromStorage();
    super(content?.cards, content?.updates);
  }

  set(set, cardNumber, cardCount) {
    super.set(set, cardNumber, cardCount);
    this.#saveToStorage();
  }

  #saveToStorage() {
    const data = this.#serializeContent();
    localStorage.setItem(LocalCardCountRepository.#storageKey, data);
  }

  static #loadFromStorage() {
    const data = localStorage.getItem(LocalCardCountRepository.#storageKey);
    return LocalCardCountRepository.#deserializeContent(data);
  }

  export() {
    return this.#serializeContent();
  }

  import(data) {
    if (!data) {
      console.log('No data to import');
      return;
    }

    const content = LocalCardCountRepository.#deserializeContent(data);

    if (!content) {
      console.log('No content to import');
      return;
    }

    this._cards = content?.cards;
    this._updates = content?.updates;

    this.#saveToStorage();
  }

  #serializeContent() {
    const json = JSON.stringify({ cards: this._cards, updates: this._updates });
    return SiteSettings.encodeStorage ? btoa(json) : json;
  }

  static #deserializeContent(content) {
    try {
      if (!content)
        return null;

      return content.startsWith("{") 
        ? JSON.parse(content) 
        : JSON.parse(atob(content));
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

class RouteCardCountRepository extends CardCountRepository {
  constructor() {
    const serialized = window.location.search.slice(1);
    const cards = CardCountSerializer.deserializeRoute(serialized);
    super(cards, null);
  }
}

class CardCountSerializer {
  static serializeRoute(cardCollection) {
    const serialized = [];

    for (const set in cardCollection) {
      const cards = cardCollection[set];
      const cardsString = CardCountSerializer.serializeSetCards(cards);

      if (!cardsString) 
        continue;
  
      const setString = `${set}-${cardsString}`;
      serialized.push(setString);
    }

    return serialized.join('&');
  }

  static serializeSetCards(cards) {
    const cardStrings = [];

    if (!Object.keys(cards).length > 0) 
      return null;

    for (let i = 1; i <= Math.max(...Object.keys(cards)); i++) {
      const count = cards[i] || 0;
      cardStrings.push(`${count}`);
    }

    return cardStrings.join('');
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
  static encodeStorage = true;

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
    const collectionSnapshot = cardCountRepository.serializeRoute();
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
    filter._status = params.get('status') || '';
    filter._rarity = params.get('rarity') || '';
    filter._set = params.get('set') || '';
    filter._booster = params.get('booster') || '';

    return filter;
  }

  appliesTo(card) {
    return card
      && this.checkQuery(card)
      && this.checkStatus(card)
      && this.checkRarity(card)
      && this.checkSet(card)
      && this.checkBooster(card);
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

  checkRarity(card) {
    return !this._rarity
      || ((card.rarity === 'd3' || card.rarity === 'd4') && this._rarity === 'regular3')
      || (card.rarity.startsWith('d') && this._rarity === 'regular')
      || (!card.rarity.startsWith('d') && this._rarity === 'secret')
      || (card.rarity === this._rarity);
  }

  checkSet(card) {
    return !this._set || card.set === this._set;
  }

  checkBooster(card) {
    return !this._booster || card.boosters.some(booster => booster.name === this._booster);
  }

  render(cardCollection) {
    this.renderSets(cardCollection);
    this.renderBoosters(cardCollection);

    document.getElementById('filter-reset').addEventListener('click', () => {
      this.reset();
      this.setInputValues();
    });

    this.setInputValues();
  }

  renderSets(cardCollection) {
    const setInputElement = document.getElementById('filter-set');
    const setDetails = cardCollection.getSetDetails();

    setDetails.forEach((set) => {
      const option = document.createElement('option');
      option.value = set.code;
      option.text = `${set.name} (${set.code})`;
      setInputElement.add(option);
    })
  }

  renderBoosters(cardCollection) {
    const boosterInputElement = document.getElementById('filter-booster');
    const boosterDetails = cardCollection.getBoosterDetails();

    boosterDetails.forEach((booster) => {
      const option = document.createElement('option');
      option.value = booster.name;
      option.text = `${booster.name} (${booster.set})`;
      boosterInputElement.add(option);
    })
  }

  setInputValues() {
    document.getElementById('filter-query').value = this._query;
    document.getElementById('filter-status').value = this._status;
    document.getElementById('filter-rarity').value = this._rarity;
    document.getElementById('filter-set').value = this._set;
    document.getElementById('filter-booster').value = this._booster;
  }

  reset() {
    this._query = '';
    this._status = '';
    this._rarity = '';
    this._set = '';
    this._booster = '';
  }
}

class NavBar {
  static render(cardCollection) {
    this.#renderSetNavigation(cardCollection);
    this.#configureToggle();
  }

  static #renderSetNavigation(cardCollection) {
    const setDetails = cardCollection.getSetDetails();
    const collectionSetsElement = document.getElementById("collection-sets");

    setDetails.forEach(setDetails => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `<a href="#${setDetails.id}">${setDetails.name}</a>`;
      collectionSetsElement.appendChild(listItem);
    });
  }

  static #configureToggle() {
    const navbarElement = document.getElementById("navbar");
    const navbarToggleElement = document.getElementById("navbar-toggle");

    navbarToggleElement.addEventListener('click', () => {
      if (navbarElement.className === "navbar") {
        navbarElement.className += " responsive";
      } else {
        navbarElement.className = "navbar";
      }
    });
  }
}

class DataManager {
  static render(repository) {
    const exportButtonElement = document.getElementById("export-button");
    exportButtonElement.addEventListener('click', () => this.onExport(repository));

    const importButtonElement = document.getElementById("import-button");
    importButtonElement.addEventListener('click', () => this.onImport(repository));
  }

  static onExport(repository) {
    const exportAreaElement = document.getElementById("export-content");
    const exportData = repository.export();
    exportAreaElement.value = exportData;
  }
  
  static onImport(repository) {
    try {
      const importAreaElement = document.getElementById("import-content");
      const importData = importAreaElement.value;

      if (!importData) {
        return;
      }

      if (confirm('Are you sure you want to import this data?')) {
        repository.import(importData);
        window.location.reload();
      }
    } catch (error) {
      alert(error.message);
    }
  }
}

SiteSettings.init();