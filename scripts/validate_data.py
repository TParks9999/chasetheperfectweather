#!/usr/bin/env python3
"""
Validate cities.json for completeness and sane ranges.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def validate(path: Path) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    cities = data.get("cities", [])

    issues = 0
    for city in cities:
        temps = city.get("t", [])
        rain = city.get("r", [])
        if len(temps) != 12 or len(rain) != 12:
            print(f"Bad month count for {city.get('n')} ({city.get('id')})")
            issues += 1
            continue

        if any(t is None for t in temps) or any(r is None for r in rain):
            print(f"Null values for {city.get('n')} ({city.get('id')})")
            issues += 1

        if any(t < -40 or t > 50 for t in temps):
            print(f"Temp out of range for {city.get('n')} ({city.get('id')}): {temps}")
            issues += 1

        if any(r < 0 or r > 1500 for r in rain):
            print(f"Rain out of range for {city.get('n')} ({city.get('id')}): {rain}")
            issues += 1

    if issues == 0:
        print(f"OK: {len(cities)} cities validated")
    else:
        print(f"Found {issues} issues across {len(cities)} cities")
    return issues


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="public/data/cities.json")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(validate(Path(args.input)))
