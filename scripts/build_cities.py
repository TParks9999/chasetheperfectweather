"""Build public/data/cities.json from GeoNames + WorldClim normals."""
from __future__ import annotations

import argparse
import json
import math
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
import rasterio


GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
GEONAMES_TXT = "cities15000.txt"
GEONAMES_ADMIN1_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"
GEONAMES_ADMIN1_TXT = "admin1CodesASCII.txt"

WORLDCLIM_BASE = "https://geodata.ucdavis.edu/climate/worldclim/2_1/base"
WORLDCLIM_TMAX = "wc2.1_10m_tmax.zip"
WORLDCLIM_PREC = "wc2.1_10m_prec.zip"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return
    print(f"Downloading {url} -> {dest}")
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                fh.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = downloaded / total * 100
                    print(f"\r  {pct:6.2f}%", end="")
        if total > 0:
            print()


def extract(zip_path: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_dir)


def parse_admin1(admin1_path: Path) -> dict[str, str]:
    admin1 = {}
    with open(admin1_path, "r", encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2:
                continue
            admin1[parts[0]] = parts[1]
    return admin1


def parse_geonames(txt_path: Path, admin1: dict[str, str], min_pop: int) -> list[dict]:
    cities = []
    with open(txt_path, "r", encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 15:
                continue
            geoname_id = int(parts[0])
            name = parts[1]
            lat = float(parts[4])
            lng = float(parts[5])
            country = parts[8]
            admin1_code = parts[10]
            try:
                pop = int(parts[14])
            except ValueError:
                pop = 0

            if pop < min_pop:
                continue
            if not country or len(country) != 2:
                continue

            admin1_key = f"{country}.{admin1_code}" if admin1_code else ""
            admin1_name = admin1.get(admin1_key, "")

            cities.append(
                {
                    "id": geoname_id,
                    "n": name,
                    "c": country,
                    "_admin1": admin1_name,
                    "_admin1_code": admin1_code,
                    "lat": round(lat, 2),
                    "lng": round(lng, 2),
                    "pop": pop,
                }
            )

    name_counts = {}
    for city in cities:
        key = (city["c"], city["n"].strip().lower())
        name_counts[key] = name_counts.get(key, 0) + 1

    for city in cities:
        key = (city["c"], city["n"].strip().lower())
        if name_counts.get(key, 0) > 1:
            if city["_admin1"]:
                city["n"] = f"{city['n']}, {city['_admin1']}"
            elif city["_admin1_code"]:
                city["n"] = f"{city['n']} ({city['_admin1_code']})"
            else:
                city["n"] = f"{city['n']} ({city['id']})"

    final_name_counts = {}
    for city in cities:
        key = (city["c"], city["n"].strip().lower())
        final_name_counts[key] = final_name_counts.get(key, 0) + 1

    for city in cities:
        key = (city["c"], city["n"].strip().lower())
        if final_name_counts.get(key, 0) > 1:
            city["n"] = f"{city['n']} ({city['id']})"

    cities.sort(key=lambda c: c["pop"], reverse=True)
    return cities


def sample_value(dataset: rasterio.DatasetReader, lng: float, lat: float) -> float | None:
    value = next(dataset.sample([(lng, lat)]))[0]
    nodata = dataset.nodata
    if nodata is not None and value == nodata:
        return None
    if math.isnan(value):
        return None
    return float(value)


def sample_with_fallback(dataset: rasterio.DatasetReader, lng: float, lat: float) -> float | None:
    value = sample_value(dataset, lng, lat)
    if value is not None:
        return value

    res_x, res_y = dataset.res
    for radius in range(1, 4):
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if dx == 0 and dy == 0:
                    continue
                candidate = sample_value(dataset, lng + dx * res_x, lat + dy * res_y)
                if candidate is not None:
                    return candidate
    return None


def open_monthly_grids(folder: Path, prefix: str) -> list[rasterio.DatasetReader]:
    datasets = []
    for month in range(1, 13):
        path = folder / f"{prefix}_{month:02d}.tif"
        if not path.exists():
            raise FileNotFoundError(f"Missing grid: {path}")
        datasets.append(rasterio.open(path))
    return datasets


def build_dataset(
    output_path: Path,
    geonames_txt: Path,
    tmax_folder: Path,
    prec_folder: Path,
    version: str,
    period: str,
    min_pop: int,
) -> dict:
    admin1 = parse_admin1(geonames_txt.parent / GEONAMES_ADMIN1_TXT)
    cities = parse_geonames(geonames_txt, admin1, min_pop=min_pop)
    print(f"Loaded {len(cities)} cities with population >= {min_pop:,}")

    tmax_grids = open_monthly_grids(tmax_folder, "wc2.1_10m_tmax")
    prec_grids = open_monthly_grids(prec_folder, "wc2.1_10m_prec")

    for city in cities:
        t_values = []
        r_values = []
        for t_ds, r_ds in zip(tmax_grids, prec_grids, strict=True):
            t_raw = sample_with_fallback(t_ds, city["lng"], city["lat"])
            r_raw = sample_with_fallback(r_ds, city["lng"], city["lat"])

            if t_raw is None or r_raw is None:
                raise RuntimeError(
                    f"Failed to sample climate data for {city['n']} ({city['c']})"
                )

            t_c = int(round(t_raw))
            r_mm = int(round(r_raw))
            t_values.append(t_c)
            r_values.append(r_mm)

        city["t"] = t_values
        city["r"] = r_values
        city.pop("_admin1", None)
        city.pop("_admin1_code", None)

    for ds in tmax_grids + prec_grids:
        ds.close()

    meta = {
        "version": version,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "period": period,
    }
    return {"meta": meta, "cities": cities}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build cities.json dataset.")
    parser.add_argument("--version", default="0.2.0")
    parser.add_argument("--period", default="1970-2000 (WorldClim v2.1)")
    parser.add_argument("--min-pop", type=int, default=500_000)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    data_dir = root / "data"
    raw_dir = data_dir / "raw"
    geonames_dir = raw_dir / "geonames"
    worldclim_dir = raw_dir / "worldclim"
    backup_dir = data_dir / "backups"

    output_path = root / "public" / "data" / "cities.json"

    backup_dir.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        backup_path = backup_dir / f"cities-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"
        if not backup_path.exists():
            backup_path.write_bytes(output_path.read_bytes())
            print(f"Backup saved to {backup_path}")

    geonames_zip = geonames_dir / "cities15000.zip"
    geonames_txt = geonames_dir / GEONAMES_TXT
    admin1_txt = geonames_dir / GEONAMES_ADMIN1_TXT

    download(GEONAMES_URL, geonames_zip)
    download(GEONAMES_ADMIN1_URL, admin1_txt)
    if not geonames_txt.exists():
        extract(geonames_zip, geonames_dir)

    tmax_zip = worldclim_dir / WORLDCLIM_TMAX
    prec_zip = worldclim_dir / WORLDCLIM_PREC
    tmax_folder = worldclim_dir / "wc2.1_10m_tmax"
    prec_folder = worldclim_dir / "wc2.1_10m_prec"

    download(f"{WORLDCLIM_BASE}/{WORLDCLIM_TMAX}", tmax_zip)
    download(f"{WORLDCLIM_BASE}/{WORLDCLIM_PREC}", prec_zip)

    if not tmax_folder.exists():
        extract(tmax_zip, tmax_folder)
    if not prec_folder.exists():
        extract(prec_zip, prec_folder)

    dataset = build_dataset(
        output_path=output_path,
        geonames_txt=geonames_txt,
        tmax_folder=tmax_folder,
        prec_folder=prec_folder,
        version=args.version,
        period=args.period,
        min_pop=args.min_pop,
    )

    output_path.write_text(
        json.dumps(dataset, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
