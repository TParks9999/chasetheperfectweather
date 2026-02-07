import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const dataPath = resolve(rootDir, 'public', 'data', 'cities.json');
const geonamesPath = resolve(rootDir, 'data', 'raw', 'geonames', 'cities15000.txt');

const MIN_POP = 500000;

const errors = [];

function addError(message) {
  errors.push(message);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value) {
  return Number.isInteger(value);
}

function isString(value) {
  return typeof value === 'string';
}

function validateMonthArray(value, label, cityId) {
  if (!Array.isArray(value)) {
    addError(`City ${cityId} ${label} must be an array`);
    return;
  }
  if (value.length !== 12) {
    addError(`City ${cityId} ${label} must have 12 values`);
    return;
  }
  for (let i = 0; i < value.length; i += 1) {
    if (!isNumber(value[i])) {
      addError(`City ${cityId} ${label}[${i}] must be a number`);
    }
  }
}

function validateRange(value, min, max) {
  return isNumber(value) && value >= min && value <= max;
}

function validateIsoDate(value) {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf());
}

function normalizeName(value) {
  if (!isString(value)) {
    return '';
  }
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

let raw;
try {
  raw = await readFile(dataPath, 'utf8');
} catch (error) {
  addError(`Failed to read ${dataPath}: ${error.message}`);
}

let parsed;
if (raw) {
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    addError(`Failed to parse JSON: ${error.message}`);
  }
}

if (parsed) {
  const { meta, cities } = parsed;
  if (!meta || typeof meta !== 'object') {
    addError('meta must be an object');
  } else {
    if (!isString(meta.version) || meta.version.trim().length === 0) {
      addError('meta.version must be a non-empty string');
    }
    if (!validateIsoDate(meta.generated)) {
      addError('meta.generated must be an ISO date string YYYY-MM-DD');
    }
    if (!isString(meta.period) || meta.period.trim().length === 0) {
      addError('meta.period must be a non-empty string');
    }
  }

  if (!Array.isArray(cities) || cities.length === 0) {
    addError('cities must be a non-empty array');
  } else {
    const ids = new Set();
    const nameCountryPairs = new Set();

    for (const city of cities) {
      if (!city || typeof city !== 'object') {
        addError('City entries must be objects');
        continue;
      }

      const {
        id, n, c, lat, lng, pop, t, r
      } = city;

      if (!isInteger(id)) {
        addError(`City id must be an integer (got ${id})`);
      } else if (ids.has(id)) {
        addError(`Duplicate city id ${id}`);
      } else {
        ids.add(id);
      }

      if (!isString(n) || n.trim().length === 0) {
        addError(`City ${id} name (n) must be a non-empty string`);
      }

      if (!isString(c) || c.length !== 2) {
        addError(`City ${id} country code (c) must be 2-letter string`);
      }

      if (!isNumber(lat) || lat < -90 || lat > 90) {
        addError(`City ${id} lat must be between -90 and 90`);
      }

      if (!isNumber(lng) || lng < -180 || lng > 180) {
        addError(`City ${id} lng must be between -180 and 180`);
      }

      if (!isNumber(pop) || pop < MIN_POP) {
        addError(`City ${id} pop must be >= ${MIN_POP.toLocaleString('en-US')}`);
      }

      validateMonthArray(t, 't', id);
      validateMonthArray(r, 'r', id);

      if (Array.isArray(t)) {
        t.forEach((value, index) => {
          if (!validateRange(value, -50, 55)) {
            addError(`City ${id} t[${index}] out of range (-50..55)`);
          }
        });
      }

      if (Array.isArray(r)) {
        r.forEach((value, index) => {
          if (!validateRange(value, 0, 2000)) {
            addError(`City ${id} r[${index}] out of range (0..2000)`);
          }
        });
      }

      if (isString(n) && isString(c)) {
        const key = `${c.toUpperCase()}::${n.trim().toLowerCase()}`;
        if (nameCountryPairs.has(key)) {
          addError(`Duplicate city name ${n} in country ${c}`);
        } else {
          nameCountryPairs.add(key);
        }
      }
    }
  }
}

if (parsed && Array.isArray(parsed.cities) && parsed.cities.length > 0) {
  let geonamesRaw;
  try {
    await access(geonamesPath);
    geonamesRaw = await readFile(geonamesPath, 'utf8');
  } catch (error) {
    console.warn(`GeoNames source not found, skipping US completeness check: ${geonamesPath}`);
  }

  if (geonamesRaw) {
    const expected = new Map();
    const lines = geonamesRaw.trim().split(/\r?\n/);
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 15) {
        continue;
      }
      const country = cols[8];
      if (country !== 'US') {
        continue;
      }
      const population = Number(cols[14] || 0);
      if (!Number.isFinite(population) || population < MIN_POP) {
        continue;
      }
      const name = cols[1];
      const asciiName = cols[2];
      const normalizedNames = new Set([
        normalizeName(name),
        normalizeName(asciiName)
      ].filter(Boolean));
      expected.set(name, normalizedNames);
    }

    const datasetNames = new Set();
    for (const city of parsed.cities) {
      if (!city || city.c !== 'US') {
        continue;
      }
      datasetNames.add(normalizeName(city.n));
    }

    for (const [displayName, normalizedNames] of expected.entries()) {
      let found = false;
      for (const normalizedName of normalizedNames) {
        if (datasetNames.has(normalizedName)) {
          found = true;
          break;
        }
      }
      if (!found) {
        addError(`Missing US city with pop >= 1,000,000 (GeoNames): ${displayName}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Cities dataset validation failed (${errors.length} issue(s)):\n`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
} else {
  console.log('Cities dataset validation passed.');
}
