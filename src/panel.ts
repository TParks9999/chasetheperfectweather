import type { City } from './data';
import { getCountryName, formatPopulation } from './data';
import { renderChart, destroyChart } from './chart';

let panelEl: HTMLElement;
let currentCity: City | null = null;
let onClose: (() => void) | null = null;

export function initPanel(onCloseCallback?: () => void) {
  onClose = onCloseCallback || null;

  panelEl = document.getElementById('detail-panel')!;

  // Close button
  panelEl.querySelector('.panel-close')!.addEventListener('click', closePanel);

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelEl.classList.contains('open')) {
      closePanel();
    }
  });
}

export function openPanel(
  city: City,
  selectedMonth: number,
  tempMin: number,
  tempMax: number,
  isFahrenheit: boolean
) {
  currentCity = city;

  // Update header
  const header = panelEl.querySelector('.panel-header-info')!;
  header.innerHTML = `
    <h2 class="panel-city-name">${city.n}</h2>
    <p class="panel-city-meta">${getCountryName(city.c)} &middot; Pop: ${formatPopulation(city.pop)}</p>
  `;

  // Show panel
  panelEl.classList.add('open');

  // Render chart after panel is open so the canvas has a real size
  const canvas = panelEl.querySelector('#city-chart') as HTMLCanvasElement;
  requestAnimationFrame(() => {
    renderChart(canvas, city, selectedMonth, tempMin, tempMax, isFahrenheit);
  });
}

export function updatePanelChart(
  selectedMonth: number,
  tempMin: number,
  tempMax: number,
  isFahrenheit: boolean
) {
  if (!currentCity || !panelEl.classList.contains('open')) return;

  const canvas = panelEl.querySelector('#city-chart') as HTMLCanvasElement;
  renderChart(canvas, currentCity, selectedMonth, tempMin, tempMax, isFahrenheit);
}

export function closePanel() {
  panelEl.classList.remove('open');
  destroyChart();
  currentCity = null;
  if (onClose) onClose();
}

export function isOpen(): boolean {
  return panelEl.classList.contains('open');
}

export function getCurrentCity(): City | null {
  return currentCity;
}
