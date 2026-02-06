import type { City } from './data';
import { getCountryName } from './data';

let cities: City[] = [];
let onSelect: ((city: City) => void) | null = null;
let inputEl: HTMLInputElement;
let resultsEl: HTMLElement;
let selectedIndex = -1;

export function initSearch(
  allCities: City[],
  selectCallback: (city: City) => void
) {
  cities = allCities;
  onSelect = selectCallback;

  inputEl = document.getElementById('city-search') as HTMLInputElement;
  resultsEl = document.getElementById('search-results')!;

  inputEl.addEventListener('input', handleInput);
  inputEl.addEventListener('keydown', handleKeydown);
  inputEl.addEventListener('focus', () => {
    if (inputEl.value.length >= 2) handleInput();
  });

  // Close results on click outside
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.search-container')) {
      closeResults();
    }
  });
}

function handleInput() {
  const query = inputEl.value.trim().toLowerCase();
  if (query.length < 2) {
    closeResults();
    return;
  }

  // Fuzzy-ish matching: prioritize starts-with, then includes
  const startsWithMatches: City[] = [];
  const includesMatches: City[] = [];

  for (const city of cities) {
    const name = city.n.toLowerCase();
    if (name.startsWith(query)) {
      startsWithMatches.push(city);
    } else if (name.includes(query)) {
      includesMatches.push(city);
    }
  }

  const results = [...startsWithMatches, ...includesMatches].slice(0, 8);
  selectedIndex = -1;
  showResults(results);
}

function showResults(results: City[]) {
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="search-no-results">No cities found</div>';
    resultsEl.classList.add('open');
    return;
  }

  resultsEl.innerHTML = results.map((city, i) => `
    <button class="search-result" data-index="${i}">
      <span class="search-result-name">${city.n}</span>
      <span class="search-result-country">${getCountryName(city.c)}</span>
    </button>
  `).join('');

  resultsEl.querySelectorAll('.search-result').forEach((el, i) => {
    el.addEventListener('click', () => selectResult(results[i]));
    el.addEventListener('mouseenter', () => {
      selectedIndex = i;
      updateHighlight();
    });
  });

  resultsEl.classList.add('open');
}

function handleKeydown(e: KeyboardEvent) {
  const items = resultsEl.querySelectorAll('.search-result');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
    updateHighlight();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateHighlight();
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    (items[selectedIndex] as HTMLElement).click();
  } else if (e.key === 'Escape') {
    closeResults();
    inputEl.blur();
  }
}

function updateHighlight() {
  const items = resultsEl.querySelectorAll('.search-result');
  items.forEach((el, i) => {
    el.classList.toggle('highlighted', i === selectedIndex);
  });
}

function selectResult(city: City) {
  inputEl.value = city.n;
  closeResults();
  if (onSelect) onSelect(city);
}

function closeResults() {
  resultsEl.classList.remove('open');
  resultsEl.innerHTML = '';
  selectedIndex = -1;
}
