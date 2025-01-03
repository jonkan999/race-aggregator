// Get references to the button and sections
const toggleButtonMobile = document.getElementById('toggleMapButtonMobile');
const raceCardsSection = document.querySelector('.race-cards-grid');
const mapSection = document.querySelector('.map-placeholder');
const pagination = document.querySelector('.pagination');
const headerRaceCards = document.getElementById('race-cards-title');
const headerRaceCardsDynamic = document.getElementById(
  'race-cards-title-dynamic'
);
const pDescription = document.querySelector('.static-description');

// Set an initial state
let isMapClose = true;
const isMobile = window.innerWidth < 545;

// Add a click event listener to the button
toggleButtonMobile.addEventListener('click', function () {
  // Toggle between the sections
  console.log('isMapClose', isMapClose);
  if (isMapClose) {
    raceCardsSection.style.display = 'none';
    mapSection.style.display = 'block';
    headerRaceCards.style.display = 'none';
    headerRaceCardsDynamic.style.display = 'none';
    pDescription.style.display = 'none';
    //mapSection.style.position = 'fixed';
    pagination.style.display = 'none';
    /* mapSection.style.zIndex = "1"; */
    toggleButtonMobile.innerHTML = `
      <div class="icon-container">
        <ion-icon name="list-outline"></ion-icon>
      </div>
      <p>Liste</p>
    `;
    toggleButtonMobile.style.bottom = '2.5rem';

    toggleButtonMobile.classList.add('active');
    //reset filter style on map open
    if (isMobile) {
      //reset filter style on map open
      const filtersSection = document.querySelector('.section-filters');
      if (filtersSection) {
        const childElements = filtersSection.children;
        filtersSection.style.opacity = '1';
        filtersSection.style.marginTop = 'var(--header-size)';
        filtersSection.style.position = 'fixed';
        for (let i = 0; i < childElements.length; i++) {
          childElements[i].style.display = 'flex';
        }
      }
      /*  mapSection.style.paddingTop = "calc(1 * (4.5rem + 2.5rem) + 0.5rem + 2*var(--header-size))" */
    }
    isMapClose = false;
  } else {
    raceCardsSection.style.display = 'block';
    mapSection.style.display = 'none';
    pagination.style.display = 'flex';
    headerRaceCardsDynamic.style.display = 'block';
    /* mapSection.style.zIndex = "-1"; */
    toggleButtonMobile.innerHTML = `
      <div class="icon-container">
        <ion-icon name="map-outline"></ion-icon>
      </div>
      <p>Kart</p>
    `;
    toggleButtonMobile.style.bottom = '6.5rem';
    toggleButtonMobile.classList.remove('active');
    isMapClose = true;
  }
});