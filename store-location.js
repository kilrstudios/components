// Version 2.2.1
(function () {
  const WORKER_URL = 'https://store-locator.kilr.workers.dev/';
  let map, markers = [], markerClusterer;
  let userLat = null, userLng = null;
  let defaultLat, defaultLng, defaultZoom;
  const loaderEl = document.querySelector('[kilr-store-locator="loader"]');

  function getCspNonce() {
    const metaNonce = document.querySelector('meta[name="csp-nonce"]');
    if (metaNonce && metaNonce.content) return metaNonce.content;
    const scriptWithNonce = document.querySelector('script[nonce]');
    return scriptWithNonce ? scriptWithNonce.getAttribute('nonce') : '';
  }

  (async function fetchKeyAndLoadMaps() {
    try {
      const response = await fetch(WORKER_URL);
      const data = await response.json();
      if (!data.apiKey) return console.error('Worker response missing "apiKey":', data);

      const callbackName = `__gmaps_cb_${Math.random().toString(36).slice(2)}`;
      const scriptEl = document.createElement('script');
      scriptEl.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&v=quarterly&libraries=places,geometry&callback=${callbackName}`;
      scriptEl.async = true;
      scriptEl.defer = true;
      scriptEl.crossOrigin = 'anonymous';
      scriptEl.referrerPolicy = 'no-referrer';
      const nonce = getCspNonce();
      if (nonce) scriptEl.setAttribute('nonce', nonce);

      window[callbackName] = function () {
        const clusterScript = document.createElement('script');
        clusterScript.src = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclustererplus@5.1.5/dist/index.min.js';
        clusterScript.async = true;
        clusterScript.defer = true;
        clusterScript.crossOrigin = 'anonymous';
        clusterScript.referrerPolicy = 'no-referrer';
        if (nonce) clusterScript.setAttribute('nonce', nonce);
        document.head.appendChild(clusterScript);
        clusterScript.onload = () => setTimeout(initMap, 500);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      };

      document.head.appendChild(scriptEl);
    } catch (err) {
      console.error('Error initializing Google Maps');
    }
  })();


  function initMap() {
    const listEl = document.querySelector('[kilr-store-locator="list"]');
    const mapEl = document.querySelector('[kilr-store-locator="map"]');
    if (!listEl || !mapEl) {
      console.error('Required elements not found:', {
        listFound: !!listEl,
        mapFound: !!mapEl
      });
      return;
    }

    mapEl.style.width = '100%';
    mapEl.style.height = '100%';

    defaultLat = parseFloat(listEl.getAttribute('data-default-lat')) || -27.46651424507259;
    defaultLng = parseFloat(listEl.getAttribute('data-default-long')) || 153.0109915457231;
    defaultZoom = parseInt(listEl.getAttribute('data-default-zoom'), 10) || 4;
    const activeZoom = parseInt(listEl.getAttribute('data-active-zoom'), 10) || 15;
    const mapId = listEl.getAttribute('data-map-id') || '';

    map = new google.maps.Map(mapEl, {
      zoom: defaultZoom,
      center: { lat: defaultLat, lng: defaultLng },
      mapId: mapId || undefined,
    });

    markers = addStoreMarkers(map, activeZoom);
    
    if (markers.length > 0) {
      markerClusterer = new MarkerClusterer(map, markers, {
        imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
      });

      // Fit bounds to show all markers
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.getPosition()));
      map.fitBounds(bounds);
    }

    setupResetButtons();
    setupSearch();

    google.maps.event.addListener(map, 'bounds_changed', () => filterItemsByMapBounds(map));
    map.addListener('zoom_changed', () => filterItemsByMapBounds(map));
    map.addListener('dragend', () => filterItemsByMapBounds(map));

    hideLoader();
  }

  // Distance calculations are now handled by the search functionality

  function addStoreMarkers(gMap, activeZoom) {
    const elements = document.querySelectorAll('[kilr-store-locator="item"]');
    const markerArr = [];
    elements.forEach((element, index) => {
      const lat = parseFloat(element.getAttribute('data-latitude'));
      const lng = parseFloat(element.getAttribute('data-longitude'));
      
      if (isNaN(lat) || isNaN(lng)) {
        // Invalid coordinates; skip marker creation
        return;
      }

      try {
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: gMap,
        });
        markerArr.push(marker);
      } catch (error) {
        // Swallow marker creation errors to avoid leaking environment details
      }
    });

    return markerArr;
  }

  function setActiveItem(activeIndex) {
    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item, idx) => {
      const titleEl = item.querySelector('[kilr-store-locator="title"]');
      const isActive = idx === activeIndex;
      item.classList.toggle('is-active', isActive);
      if (titleEl) titleEl.classList.toggle('is-active', isActive);
    });
  }

  function setupResetButtons() {
    const resetButtons = document.querySelectorAll('[kilr-store-locator="reset"]');
    resetButtons.forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        resetMapMarkersAndItems();
      });
    });
  }

  function resetMapMarkersAndItems() {
    map.setCenter({ lat: defaultLat, lng: defaultLng });
    map.setZoom(defaultZoom);
    markerClusterer.clearMarkers();
    markerClusterer.addMarkers(markers);

    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
      item.style.display = '';
      item.classList.remove('is-active');
    });
  }

  function setupSearch() {
    const searchInput = document.querySelector('[kilr-store-locator="search"]');
    if (!searchInput) return;

    const geocoder = new google.maps.Geocoder();
    let searchTimeout;

    searchInput.addEventListener('input', () => {
        const address = searchInput.value.trim();
        if (!address || address.length < 3) {
            resetMapMarkersAndItems();
            clearDistances();
            return;
        }

        // Clear existing timeout
        if (searchTimeout) clearTimeout(searchTimeout);

        // Add debounce to prevent too many geocoding requests
        searchTimeout = setTimeout(() => {
            geocoder.geocode({ address }, (results, status) => {
                if (status === 'OK' && results.length) {
                    const searchLocation = results[0].geometry.location;
                    filterMarkersAndItems(searchLocation);
                    updateDistancesFromLocation(searchLocation);
                } else {
                    resetMapMarkersAndItems();
                    clearDistances();
                }
            });
        }, 500);
    });
}

function updateDistancesFromLocation(location) {
    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
        const distanceEl = item.querySelector('[kilr-store-locator="distance"]');
        if (!distanceEl) return;

        const lat = parseFloat(item.getAttribute('data-latitude'));
        const lng = parseFloat(item.getAttribute('data-longitude'));
        if (isNaN(lat) || isNaN(lng)) return;

        const storePos = new google.maps.LatLng(lat, lng);
        const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(location, storePos);
        distanceEl.textContent = distanceMeters < 1000
            ? `${distanceMeters.toFixed(0)} m away`
            : `${(distanceMeters / 1000).toFixed(1)} km away`;
    });
}

function clearDistances() {
    const distanceElements = document.querySelectorAll('[kilr-store-locator="distance"]');
    distanceElements.forEach(el => el.textContent = '');
}

  function filterMarkersAndItems(location) {
    const filteredMarkers = [];
    const bounds = new google.maps.LatLngBounds();
    const items = document.querySelectorAll('[kilr-store-locator="item"]');

    markers.forEach((marker, index) => {
      const distance = google.maps.geometry.spherical.computeDistanceBetween(marker.getPosition(), location);
      if (distance < 50000) {
        filteredMarkers.push(marker);
        bounds.extend(marker.getPosition());
        items[index].style.display = '';
      } else {
        items[index].style.display = 'none';
      }
    });

    markerClusterer.clearMarkers();
    markerClusterer.addMarkers(filteredMarkers);

    if (filteredMarkers.length > 0) {
      map.fitBounds(bounds);
    } else {
      map.setCenter(location);
      map.setZoom(defaultZoom);
    }
  }

  function filterItemsByMapBounds(gMap) {
    const bounds = gMap.getBounds();
    if (!bounds) return;

    const items = document.querySelectorAll('[kilr-store-locator="item"]');
    items.forEach((item) => {
      const lat = parseFloat(item.getAttribute('data-latitude'));
      const lng = parseFloat(item.getAttribute('data-longitude'));
      const pos = new google.maps.LatLng(lat, lng);
      const isVisible = bounds.contains(pos);
      item.style.display = isVisible ? '' : 'none';
    });
  }

  function hideLoader() {
    if (loaderEl) loaderEl.style.display = 'none';
  }
})();
