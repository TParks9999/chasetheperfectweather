# Best Time to Travel

Web app to help pick the best time to visit a city using monthly climate normals.

## Tools & Tech
- Vite (dev server + build).
- TypeScript (ES modules).
- Vanilla DOM + CSS.
- Static hosting friendly (e.g., Cloudflare Pages).

## Data Sources
- `public/data/cities.json` is the only dataset loaded at runtime.
- Climate normals (monthly temperature and rainfall) come from WorldClim v2.1, 1970-2000 (see dataset metadata).
- City coordinates and population are included in the same dataset.

## Local Development
- `npm install`
- `npm run dev`

## Tests
- `npm run test`
- The GeoNames raw source check is skipped if `data/raw/geonames/cities15000.txt` is missing.

## Production Build
- `npm run build`
- `npm run preview`
