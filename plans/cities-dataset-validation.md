<proposed_plan>
**Title**
Add Dataset Validation Test for `public/data/cities.json`

**Summary**
Create a simple Node-based validation script and wire it to `npm test`. The script will load `public/data/cities.json` and enforce schema correctness, data ranges, and uniqueness constraints (ID uniqueness and name uniqueness within a country). It exits non-zero on failure to support CI/automation.

**Important Changes / Public API**
- Adds a new `npm test` script to `package.json` (no new dependencies).
- Adds a validation script in `scripts/` that reads `public/data/cities.json`.

**Implementation Plan**
1. **Script location and wiring**
   - Add `scripts/validate-cities.mjs` (ESM Node script).
   - Add `npm test` to `package.json`:
     - `test`: `node scripts/validate-cities.mjs`

2. **Validation rules**
   - File exists and JSON parses.
   - `meta`:
     - `version` is non-empty string.
     - `generated` is ISO date string `YYYY-MM-DD`.
     - `period` is non-empty string.
   - `cities`:
     - Non-empty array.
     - Each city object has:
       - `id` number (integer).
       - `n` string (non-empty).
       - `c` string (length 2).
       - `lat` number within [-90, 90].
       - `lng` number within [-180, 180].
       - `pop` number >= 1,000,000.
       - `t` array of length 12, all numbers.
       - `r` array of length 12, all numbers.
   - **Uniqueness**
     - `id` unique across all cities.
     - `n` unique within each `c` (case-insensitive comparison).

3. **Error reporting**
   - Accumulate errors and print a readable summary.
   - Exit with code `1` if any errors exist, otherwise `0`.

**Test Cases and Scenarios**
- Run `npm test` with current sample file:
  - Should pass if all fields meet constraints.
- Introduce a known failure (duplicate id or missing `t` entry):
  - Should fail with a clear error list.

**Assumptions and Defaults**
- Script is plain Node ESM (`.mjs`) to avoid adding dependencies.
- Name uniqueness is enforced per country code using case-insensitive comparison.
</proposed_plan>
