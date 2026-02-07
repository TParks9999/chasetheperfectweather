import '../styles/main.css';
import { loadCities } from './data';
import { initMap, addCities, updateMarkerColors, setMarkerClickHandler, panToCity, setupZoomHandler } from './map';
import { initControls, getState, type FilterState } from './controls';
import { initPanel, openPanel, updatePanelChart } from './panel';
import { initSearch } from './search';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand-title">Chase the Perfect Weather</span>
      </div>
      <div class="search-container">
        <input id="city-search" class="search-input" type="text" placeholder="Search a city" />
        <div id="search-results" class="search-results"></div>
      </div>
    </header>

    <section id="controls" class="controls"></section>

    <div class="content">
      <div id="map" class="map"></div>

      <aside id="detail-panel" class="detail-panel">
        <div class="panel-header">
          <div class="panel-header-info"></div>
          <button class="panel-close" aria-label="Close">&times;</button>
        </div>
        <div class="panel-body">
          <div class="chart-wrap">
            <canvas id="city-chart"></canvas>
          </div>
        </div>
      </aside>
    </div>

    <div class="legend">
      <span class="legend-item"><span class="legend-dot too-hot"></span>Too hot</span>
      <span class="legend-item"><span class="legend-dot too-cold"></span>Too cold</span>
      <span class="legend-item"><span class="legend-dot in-range"></span>Just right</span>
    </div>

    <div id="empty-banner" class="empty-banner">No cities match this filter. Try widening your temperature range.</div>
    <div id="loading" class="loading">Loading cities...</div>
  </div>
`;

const emptyBanner = document.getElementById('empty-banner')!;
const loadingEl = document.getElementById('loading')!;

function applyFilters(state: FilterState) {
  const matches = updateMarkerColors(state.month, state.tempMin, state.tempMax, state.maxRain);
  emptyBanner.classList.toggle('show', matches === 0);
  updatePanelChart(state.month, state.tempMin, state.tempMax, state.isFahrenheit);
}

async function boot() {
  try {
    const data = await loadCities();
    const cities = data.cities;

    initMap('map');
    addCities(cities);
    setupZoomHandler();

    initPanel();

    setMarkerClickHandler((city) => {
      const state = getState();
      openPanel(city, state.month, state.tempMin, state.tempMax, state.isFahrenheit);
    });

    initControls(document.getElementById('controls')!, applyFilters);
    initSearch(cities, (city) => {
      panToCity(city);
      const state = getState();
      openPanel(city, state.month, state.tempMin, state.tempMax, state.isFahrenheit);
    });

    loadingEl.classList.add('hidden');
  } catch (error) {
    loadingEl.textContent = 'Failed to load city data.';
    console.error(error);
  }
}

boot();


