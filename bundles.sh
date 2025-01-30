# Create CSS bundle (all CSS files except mapbox)
cat build/se/css/general.css build/se/css/header-menu.css build/se/css/loader.css build/se/css/breadcrumbs.css build/se/css/ads.css build/se/css/race-list-filter.css build/se/css/race-list-dynamic-titles.css build/se/css/selected-races.css build/se/css/race-card-big.css build/se/css/race-cards.css build/se/css/race-card.css > build/se/css/bundle.css

# Create JS bundle (only the race-related scripts)
cat build/se/js/raceListMap.js build/se/js/raceListDisengeageFilters.js build/se/js/raceListToggleButton.js build/se/js/raceListToggleMap.js > build/se/js/race-bundle.js

