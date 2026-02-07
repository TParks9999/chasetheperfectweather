export interface City {
  id: number;
  n: string;      // name
  c: string;      // country code (ISO 3166-1 alpha-2)
  lat: number;
  lng: number;
  pop: number;
  t: number[];    // 12 monthly avg max temps (C), index 0 = Jan
  r: number[];    // 12 monthly total rainfall (mm)
}

export interface CitiesData {
  meta: {
    version: string;
    generated: string;
    period: string;
  };
  cities: City[];
}

export async function loadCities(): Promise<CitiesData> {
  const response = await fetch('/data/cities.json');
  if (!response.ok) {
    throw new Error(`Failed to load cities data: ${response.status}`);
  }
  return response.json();
}

export function celsiusToFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

export function fahrenheitToCelsius(f: number): number {
  return Math.round((f - 32) * 5 / 9);
}

let displayNames: Intl.DisplayNames | null = null;

export function getCountryName(code: string): string {
  const normalized = code?.toUpperCase();
  if (!normalized) return code;
  if (!displayNames && typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  }
  const resolved = displayNames?.of(normalized);
  return resolved || normalized;
}

export function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toString();
}
