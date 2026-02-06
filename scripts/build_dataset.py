#!/usr/bin/env python3
"""
Build cities.json from GeoNames + Meteostat normals + Open-Meteo fallback.

Usage:
  python scripts/build_dataset.py --output public/data/cities.json
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import io
import json
import math
import os
import sys
import time
import urllib.parse
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import requests

GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
METEOSTAT_STATIONS_URL = "https://bulk.meteostat.net/v2/stations/full.json.gz"
METEOSTAT_NORMALS_URL_TEMPLATE = "https://bulk.meteostat.net/v2/normals/{station}.csv.gz"
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
MIN_GEONAMES_ZIP_BYTES = 2_000_000
MIN_METEOSTAT_STATIONS_BYTES = 50_000_000


@dataclass
class City:
    id: int
    name: str
    country: str
    lat: float
    lng: float
    pop: int


@dataclass
class Climate:
    temps: List[float]  # 12 monthly avg max temps (C)
    rain: List[float]   # 12 monthly total rainfall (mm)


def download(url: str, dest: Path, chunk_size: int = 1024 * 1024, min_bytes: int = 0, force: bool = False) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and not force:
        if min_bytes and dest.stat().st_size < min_bytes:
            print(f"Cached file too small, re-downloading {dest}")
        else:
            return
    if dest.exists() and (force or (min_bytes and dest.stat().st_size < min_bytes)):
        dest.unlink()
    if dest.exists():
        return
    print(f"Downloading {url} -> {dest}")
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)


def load_cities(geonames_zip: Path, min_pop: int) -> List[City]:
    cities: List[City] = []
    with zipfile.ZipFile(geonames_zip, "r") as zf:
        with zf.open("cities15000.txt") as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding="utf-8"), delimiter="\t")
            for row in reader:
                # GeoNames schema: https://download.geonames.org/export/dump/
                geoname_id = int(row[0])
                name = row[2] or row[1]
                lat = float(row[4])
                lng = float(row[5])
                country = row[8]
                pop = int(row[14]) if row[14] else 0
                if pop < min_pop:
                    continue
                cities.append(City(geoname_id, name, country, lat, lng, pop))
    print(f"Loaded {len(cities)} cities (pop >= {min_pop})")
    return cities


def load_meteostat_stations(stations_gz: Path, period_start: int, period_end: int) -> List[dict]:
    with gzip.open(stations_gz, "rt", encoding="utf-8") as f:
        first = f.read(1)
        f.seek(0)
        if first == "[":
            data = json.load(f)
        else:
            data = [json.loads(line) for line in f if line.strip()]

    stations = []
    for station in data:
        inv = station.get("inventory", {})
        normals = inv.get("normals", {})
        if not normals:
            continue
        start_val = normals.get("start")
        end_val = normals.get("end")
        if start_val is None or end_val is None:
            continue
        start = int(start_val)
        end = int(end_val)
        if start > period_start or end < period_end:
            continue
        loc = station.get("location") or {}
        lat = station.get("latitude", loc.get("latitude"))
        lon = station.get("longitude", loc.get("longitude"))
        if lat is None or lon is None:
            continue
        station = dict(station)
        station["latitude"] = float(lat)
        station["longitude"] = float(lon)
        stations.append(station)

    print(f"Loaded {len(stations)} Meteostat stations with normals {period_start}-{period_end}")
    return stations


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_station_index(stations: List[dict], bin_size: float = 1.0) -> Dict[Tuple[int, int], List[dict]]:
    bins: Dict[Tuple[int, int], List[dict]] = {}
    for st in stations:
        lat = st["latitude"]
        lon = st["longitude"]
        lat_bin = int(math.floor((lat + 90) / bin_size))
        lon_bin = int(math.floor((lon + 180) / bin_size))
        bins.setdefault((lat_bin, lon_bin), []).append(st)
    return bins


def find_nearest_station(
    city: City,
    bins: Dict[Tuple[int, int], List[dict]],
    bin_size: float,
    max_km: float,
) -> Optional[dict]:
    lat = city.lat
    lon = city.lng
    lat_delta = max_km / 111.0
    lon_delta = max_km / (111.0 * max(0.1, math.cos(math.radians(lat))))

    min_lat = lat - lat_delta
    max_lat = lat + lat_delta
    min_lon = lon - lon_delta
    max_lon = lon + lon_delta

    lat_bin_min = int(math.floor((min_lat + 90) / bin_size))
    lat_bin_max = int(math.floor((max_lat + 90) / bin_size))
    lon_bin_min = int(math.floor((min_lon + 180) / bin_size))
    lon_bin_max = int(math.floor((max_lon + 180) / bin_size))

    best = None
    best_dist = 1e9
    for lat_bin in range(lat_bin_min, lat_bin_max + 1):
        for lon_bin in range(lon_bin_min, lon_bin_max + 1):
            for st in bins.get((lat_bin, lon_bin), []):
                d = haversine_km(lat, lon, st["latitude"], st["longitude"])
                if d < best_dist:
                    best_dist = d
                    best = st

    if best and best_dist <= max_km:
        return best
    return None


def fetch_meteostat_normals(station_id: str, cache_dir: Path) -> Optional[Climate]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{station_id}.csv.gz"
    if not cache_file.exists():
        url = METEOSTAT_NORMALS_URL_TEMPLATE.format(station=station_id)
        try:
            download(url, cache_file)
        except Exception:
            return None

    with gzip.open(cache_file, "rt", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Meteostat normals contain period rows. We want 1991-2020.
    row = None
    for r in rows:
        if r.get("start") == "1991" and r.get("end") == "2020":
            row = r
            break
    if row is None:
        return None

    temps = []
    rain = []
    for m in range(1, 13):
        t_key = f"tmax_{m:02d}"
        r_key = f"prcp_{m:02d}"
        if row.get(t_key) in (None, "") or row.get(r_key) in (None, ""):
            return None
        temps.append(round(float(row[t_key]), 1))
        rain.append(round(float(row[r_key]), 1))

    return Climate(temps=temps, rain=rain)


def fetch_open_meteo(city: City, start_year: int, end_year: int, sleep_s: float) -> Optional[Climate]:
    params = {
        "latitude": city.lat,
        "longitude": city.lng,
        "start_date": f"{start_year}-01-01",
        "end_date": f"{end_year}-12-31",
        "daily": "temperature_2m_max,precipitation_sum",
        "timezone": "UTC",
    }

    url = OPEN_METEO_URL + "?" + urllib.parse.urlencode(params)
    try:
        resp = requests.get(url, timeout=90)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None
    finally:
        if sleep_s > 0:
            time.sleep(sleep_s)

    daily = data.get("daily", {})
    dates = daily.get("time", [])
    temps = daily.get("temperature_2m_max", [])
    prec = daily.get("precipitation_sum", [])
    if not dates or not temps or not prec:
        return None

    # Aggregate by month across years
    temp_sum = [0.0] * 12
    temp_count = [0] * 12
    rain_sum = [0.0] * 12
    rain_years = [0] * 12

    current_month = None
    current_year = None
    month_rain = 0.0

    for date_str, t, r in zip(dates, temps, prec):
        try:
            d = dt.date.fromisoformat(date_str)
        except Exception:
            continue
        m = d.month - 1

        if current_month is None:
            current_month = m
            current_year = d.year
            month_rain = 0.0

        if d.year != current_year or m != current_month:
            rain_sum[current_month] += month_rain
            rain_years[current_month] += 1
            current_month = m
            current_year = d.year
            month_rain = 0.0

        if t is not None:
            temp_sum[m] += float(t)
            temp_count[m] += 1
        if r is not None:
            month_rain += float(r)

    if current_month is not None:
        rain_sum[current_month] += month_rain
        rain_years[current_month] += 1

    temps_out = []
    rain_out = []
    for i in range(12):
        if temp_count[i] == 0 or rain_years[i] == 0:
            return None
        temps_out.append(round(temp_sum[i] / temp_count[i], 1))
        rain_out.append(round(rain_sum[i] / rain_years[i], 1))

    return Climate(temps=temps_out, rain=rain_out)


def load_progress(progress_file: Path) -> Dict[int, dict]:
    if not progress_file.exists():
        return {}
    data = {}
    with open(progress_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            obj = json.loads(line)
            data[int(obj["id"])] = obj
    return data


def append_progress(progress_file: Path, entry: dict) -> None:
    progress_file.parent.mkdir(parents=True, exist_ok=True)
    with open(progress_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, separators=(",", ":")) + "\n")


def build_dataset(args: argparse.Namespace) -> None:
    cache_dir = Path(args.cache_dir)
    downloads = cache_dir / "downloads"
    normals_cache = cache_dir / "meteostat_normals"
    progress_file = cache_dir / "progress.jsonl"

    geonames_zip = downloads / "cities15000.zip"
    stations_gz = downloads / "meteostat_stations_full.json.gz"

    download(GEONAMES_URL, geonames_zip, min_bytes=MIN_GEONAMES_ZIP_BYTES, force=args.force_download)
    download(METEOSTAT_STATIONS_URL, stations_gz, min_bytes=MIN_METEOSTAT_STATIONS_BYTES, force=args.force_download)

    cities = load_cities(geonames_zip, args.min_pop)
    if args.max_cities:
        cities = cities[: args.max_cities]

    stations = load_meteostat_stations(stations_gz, args.period_start, args.period_end)
    if not stations:
        print("Warning: No Meteostat stations loaded. Check stations download size and availability.")
    station_bins = build_station_index(stations, bin_size=args.station_bin_size)

    progress = load_progress(progress_file)

    results: List[dict] = []
    for city in cities:
        if city.id in progress:
            results.append(progress[city.id])
            continue

        climate = None
        station = find_nearest_station(city, station_bins, args.station_bin_size, args.max_station_km)
        if station:
            climate = fetch_meteostat_normals(station["id"], normals_cache)

        if climate is None:
            climate = fetch_open_meteo(city, args.period_start, args.period_end, args.open_meteo_sleep)

        if climate is None:
            print(f"Missing climate data for {city.name} ({city.id})")
            continue

        entry = {
            "id": city.id,
            "n": city.name,
            "c": city.country,
            "lat": round(city.lat, 4),
            "lng": round(city.lng, 4),
            "pop": city.pop,
            "t": climate.temps,
            "r": climate.rain,
        }
        append_progress(progress_file, entry)
        results.append(entry)

    output = {
        "meta": {
            "version": args.version,
            "generated": dt.date.today().isoformat(),
            "period": f"{args.period_start}-{args.period_end}",
        },
        "cities": results,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"))

    print(f"Wrote {len(results)} cities to {output_path}")


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build cities.json dataset.")
    parser.add_argument("--output", default="public/data/cities.json")
    parser.add_argument("--min-pop", type=int, default=100_000)
    parser.add_argument("--period-start", type=int, default=1991)
    parser.add_argument("--period-end", type=int, default=2020)
    parser.add_argument("--version", default="1.0")
    parser.add_argument("--cache-dir", default="scripts/cache")
    parser.add_argument("--max-cities", type=int, default=0, help="Limit cities for testing")
    parser.add_argument("--max-station-km", type=float, default=150.0)
    parser.add_argument("--station-bin-size", type=float, default=1.0)
    parser.add_argument("--open-meteo-sleep", type=float, default=0.2)
    parser.add_argument("--force-download", action="store_true", help="Re-download cached source files")
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_args()
    build_dataset(args)
