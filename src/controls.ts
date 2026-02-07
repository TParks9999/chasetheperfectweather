import noUiSlider from 'nouislider';
import type { target as NoUiTarget } from 'nouislider';
import 'nouislider/dist/nouislider.css';
import { celsiusToFahrenheit } from './data';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STORAGE_KEY = 'travel-map-state';

export interface FilterState {
  month: number;       // 0-11
  tempMin: number;     // Celsius
  tempMax: number;     // Celsius
  maxRain: number;     // mm
  isFahrenheit: boolean;
}

type FilterCallback = (state: FilterState) => void;

let state: FilterState;
let onChange: FilterCallback | null = null;
let sliderEl: NoUiTarget;
let rainSliderEl: NoUiTarget;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadState(): FilterState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FilterState>;
      const tempMinRaw = Number.isFinite(parsed.tempMin) ? parsed.tempMin! : 20;
      const tempMaxRaw = Number.isFinite(parsed.tempMax) ? parsed.tempMax! : 30;
      let tempMin = clamp(tempMinRaw, -10, 40);
      let tempMax = clamp(tempMaxRaw, -10, 40);
      if (tempMin > tempMax) {
        [tempMin, tempMax] = [tempMax, tempMin];
      }
      const monthRaw = Number.isFinite(parsed.month) ? parsed.month! : new Date().getMonth();
      const maxRainRaw = Number.isFinite(parsed.maxRain) ? parsed.maxRain! : 200;
      return {
        month: clamp(monthRaw, 0, 11),
        tempMin,
        tempMax,
        maxRain: clamp(maxRainRaw, 0, 900),
        isFahrenheit: typeof parsed.isFahrenheit === 'boolean' ? parsed.isFahrenheit : false,
      };
    }
  } catch { /* ignore */ }

  return {
    month: new Date().getMonth(),
    tempMin: 20,
    tempMax: 30,
    maxRain: 200,
    isFahrenheit: false,
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function formatTemp(celsius: number): string {
  if (state.isFahrenheit) {
    return `${celsiusToFahrenheit(celsius)} F`;
  }
  return `${celsius} C`;
}

function updateSliderLabels() {
  const minLabel = document.getElementById('temp-min-label');
  const maxLabel = document.getElementById('temp-max-label');
  if (minLabel) minLabel.textContent = formatTemp(state.tempMin);
  if (maxLabel) maxLabel.textContent = formatTemp(state.tempMax);
}

function updateRainLabel() {
  const rainLabel = document.getElementById('rain-max-label');
  if (rainLabel) rainLabel.textContent = `${state.maxRain} mm`;
}

function updateUnitButton() {
  const btn = document.getElementById('unit-toggle');
  if (btn) btn.textContent = state.isFahrenheit ? 'F' : 'C';
}

function emitChange() {
  saveState();
  if (onChange) onChange(state);
}

export function initControls(container: HTMLElement, callback: FilterCallback) {
  onChange = callback;
  state = loadState();

  // Build HTML
  container.innerHTML = `
    <div class="controls-bar">
      <div class="controls-section month-section">
        <span class="controls-label">Month:</span>
        <div class="month-buttons" id="month-buttons">
          ${MONTHS.map((m, i) => `<button class="month-btn${i === state.month ? ' active' : ''}" data-month="${i}">${m}</button>`).join('')}
        </div>
      </div>
      <div class="controls-section filters-section">
        <div class="temp-section">
          <span class="controls-label">Temperature:</span>
          <button class="unit-toggle" id="unit-toggle"></button>
          <span class="temp-label" id="temp-min-label"></span>
          <div id="temp-slider" class="temp-slider"></div>
          <span class="temp-label" id="temp-max-label"></span>
        </div>
        <div class="rain-section">
          <span class="controls-label">Rainfall Limit:</span>
          <span class="rain-label" id="rain-max-label"></span>
          <div id="rain-slider" class="rain-slider"></div>
        </div>
      </div>
    </div>
  `;

  // Month buttons
  const monthBtns = container.querySelectorAll('.month-btn');
  monthBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      monthBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.month = parseInt(btn.getAttribute('data-month')!, 10);
      emitChange();
    });
  });

  // Temperature slider
  sliderEl = document.getElementById('temp-slider')! as NoUiTarget;
  noUiSlider.create(sliderEl, {
    start: [state.tempMin, state.tempMax],
    connect: true,
    step: 1,
    range: { min: -10, max: 40 },
    behaviour: 'tap-drag',
  });

  sliderEl.noUiSlider!.on('update', (values: (string | number)[]) => {
    state.tempMin = Math.round(Number(values[0]));
    state.tempMax = Math.round(Number(values[1]));
    updateSliderLabels();
  });

  sliderEl.noUiSlider!.on('change', () => {
    emitChange();
  });

  // Rainfall slider
  rainSliderEl = document.getElementById('rain-slider')! as NoUiTarget;
  noUiSlider.create(rainSliderEl, {
    start: [state.maxRain],
    connect: [true, false],
    step: 10,
    range: { min: 0, max: 900 },
    behaviour: 'tap-drag',
  });

  rainSliderEl.noUiSlider!.on('update', (values: (string | number)[]) => {
    const next = Math.round(Number(values[0]));
    if (Number.isFinite(next)) {
      state.maxRain = next;
    }
    updateRainLabel();
  });

  rainSliderEl.noUiSlider!.on('change', () => {
    emitChange();
  });

  // Unit toggle
  const unitBtn = document.getElementById('unit-toggle')!;
  unitBtn.addEventListener('click', () => {
    state.isFahrenheit = !state.isFahrenheit;
    updateUnitButton();
    updateSliderLabels();
    emitChange();
  });

  // Initial UI state
  updateUnitButton();
  updateSliderLabels();
  updateRainLabel();

  // Fire initial callback
  emitChange();
}

export function getState(): FilterState {
  return state;
}

