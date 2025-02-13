function initialise() {
  configureCards();
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