Title
  Expand cities.json to All Cities With Population > 1,000,000       
  Using GeoNames + WorldClim Normals

  Summary
  We will build a reproducible data pipeline that:
  1. Backs up the current public/data/cities.json to data/backups/   
     cities-YYYY-MM-DD.json.
  2. Downloads GeoNames cities15000 for global city metadata and     
  3. Downloads WorldClim monthly normals for tmax and prec at 10     
  4. Samples climate grids at each city’s lat/lng, producing 12      
     monthly avg max temps (°C) and monthly total rainfall (mm).     
  5. Writes the full dataset into public/data/cities.json with the   
     existing schema and updated meta.

  Important Changes / Public API

  - No schema changes to public/data/cities.json. It remains:        
      - meta: { version, generated, period }
      - cities: City[] with keys id, n, c, lat, lng, pop, t, r       
  - meta.version will be bumped (e.g., 0.2.0), meta.generated set    
    to run date, meta.period set to the climate normals period       
    used.

  Implementation Plan

  1. Inspect and preserve current dataset
      - Copy public/data/cities.json to data/backups/cities-YYYY-    
        MM-DD.json.
      - This backup is non-public and date-stamped.
  2. Create data build script
        download, parsing, sampling, and output.
      - Dependencies: python, requests, numpy, rasterio (or xarray   
        + rioxarray).
      - Keep all intermediate downloads in data/raw/ and extracted   
        grids in data/raw/worldclim/.
      - Ensure data/raw/ is gitignored if not already.
  3. Download and parse GeoNames
      - Download GeoNames cities15000.zip.
      - Parse cities15000.txt.
      - Filter to:
          - population >= 1_000_000
          - non-null lat/lng
          - valid country code
      - Map to schema:
          - id = geonameid
          - n = name
          - c = country_code (ISO 3166-1 alpha‑2)
          - lat, lng, pop
      - Sort by pop descending for deterministic order.
  4. Download WorldClim normals
      - Use WorldClim v2.1 monthly normals:
          - tmax (°C * 10 in WorldClim; convert to °C)
          - prec (mm)
      - Target 1991–2020 @ 10 arc‑min. If WorldClim does not
        provide 1991–2020, fall back to the closest available        
      - Store raw files in data/raw/worldclim/.
      - For each city:
          - Sample 12 tmax monthly grids at city coordinates.        
          - Convert tmax to integer °C (round to nearest integer to  
            match current dataset).
          - Sample 12 prec monthly grids (mm).
          - Round rainfall to integer mm.
      - If a city falls on a NoData pixel, sample nearest valid      
  6. Write public/data/cities.json
      - Output with current schema:
          - meta.version, meta.generated (YYYY-MM-DD), meta.period   
          - cities array with all filtered cities
      - Keep keys short to avoid file bloat.
      - Validate:
          - lat in [-90, 90], lng in [-180, 180].
          - pop >= 1_000_000.
      - Spot-check a few cities’ climate values against known        
        climate profiles.
  8. Optional documentation
        and how to run the script.
  Test Cases and Scenarios

  - Run scripts/build_cities.py end-to-end:
      - meta.period reflects actual WorldClim period used.
  - Sanity checks via script logs:
      - Count of cities (expected ~500–600 cities >= 1M).
      - Example outputs:
          - A desert city has low rainfall values.
  - Run npm run build to ensure the app loads the new dataset        
    without type/runtime errors.

  Assumptions and Defaults

  - City source: GeoNames cities15000 (CC BY 4.0).
  - Climate source: WorldClim v2.1 monthly normals.
  - Period/resolution: 1991–2020 @ 10 arc‑min if available;
    otherwise fallback and update meta.period.
  - Backup: data/backups/cities-YYYY-MM-DD.json only.
    }