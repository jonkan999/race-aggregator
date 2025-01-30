// Get references to the button and sections

const toggleButtonMobile = document.getElementById('toggleMapButtonMobile');
const raceCardsSection = document.querySelector('.race-cards-grid');
const mapSection = document.querySelector('.map-placeholder');
const pagination = document.querySelector('.pagination');
const headerRaceCards = document.querySelector(
  '.section-race-cards-header-container'
);

// Set an initial state
let isMapClose = true;
const isMobile = window.innerWidth < 545;

// Add a click event listener to the button
toggleButtonMobile.addEventListener('click', async function () {
  // Toggle between the sections
  console.log('isMapClose', isMapClose);
  if (isMapClose) {
    raceCardsSection.style.display = 'none';
    mapSection.style.display = 'block';
    headerRaceCards.style.display = 'none';
    pagination.style.display = 'none';
    toggleButtonMobile.innerHTML = `
      <svg class="icon" role="img" aria-label="list outline">
        <use xlink:href="/icons/svg-sprite.svg#list-outline"></use>
      </svg>
      <p>{{map_toggle_mobile_list}}</p>
    `;
    toggleButtonMobile.style.bottom = '2.5rem';
    toggleButtonMobile.classList.add('active');

    // Initialize map when showing it
    if (window.initializeMap) {
      await window.initializeMap();
    }
    if (window.updateClusters) {
      window.updateClusters();
    }

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
    }
    isMapClose = false;
  } else {
    raceCardsSection.style.display = 'block';
    mapSection.style.display = 'none';
    pagination.style.display = 'flex';
    headerRaceCards.style.display = 'block';
    toggleButtonMobile.innerHTML = `
      <div class="icon-container">
        <svg class="icon" role="img" aria-label="map outline">
          <use xlink:href="/icons/svg-sprite.svg#map-outline"></use>
        </svg>
      </div>
      <p>{{map_toggle_mobile}}</p>
    `;
    toggleButtonMobile.style.bottom = '6.5rem';
    toggleButtonMobile.classList.remove('active');
    isMapClose = true;
  }
});
