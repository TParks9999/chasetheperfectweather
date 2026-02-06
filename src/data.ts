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

const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina', AU: 'Australia',
  AT: 'Austria', BD: 'Bangladesh', BE: 'Belgium', BR: 'Brazil', BG: 'Bulgaria',
  KH: 'Cambodia', CA: 'Canada', CL: 'Chile', CN: 'China', CO: 'Colombia',
  HR: 'Croatia', CU: 'Cuba', CZ: 'Czechia', DK: 'Denmark', EC: 'Ecuador',
  EG: 'Egypt', ET: 'Ethiopia', FI: 'Finland', FR: 'France', DE: 'Germany',
  GH: 'Ghana', GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary', IN: 'India',
  ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland', IL: 'Israel',
  IT: 'Italy', JP: 'Japan', JO: 'Jordan', KE: 'Kenya', KR: 'South Korea',
  KW: 'Kuwait', LB: 'Lebanon', MY: 'Malaysia', MX: 'Mexico', MA: 'Morocco',
  MM: 'Myanmar', NP: 'Nepal', NL: 'Netherlands', NZ: 'New Zealand', NG: 'Nigeria',
  NO: 'Norway', PK: 'Pakistan', PE: 'Peru', PH: 'Philippines', PL: 'Poland',
  PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia',
  SG: 'Singapore', ZA: 'South Africa', ES: 'Spain', LK: 'Sri Lanka', SE: 'Sweden',
  CH: 'Switzerland', TW: 'Taiwan', TH: 'Thailand', TR: 'Turkey', AE: 'UAE',
  UA: 'Ukraine', GB: 'United Kingdom', US: 'United States', VN: 'Vietnam',
  TZ: 'Tanzania', UG: 'Uganda', VE: 'Venezuela', LA: 'Laos',
  UZ: 'Uzbekistan', RS: 'Serbia', IS: 'Iceland'
};

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

export function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toString();
}
