# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source modules (e.g., `main.ts`, `map.ts`, `chart.ts`, `search.ts`). Each file owns a focused UI/data concern.
- `public/`: Static assets served by Vite. Data lives in `public/data/` (currently `cities.json`).
- `styles/`: Reserved for CSS. Currently empty; add global styles here if needed.
- Root files: `index.html` (app entry), `tsconfig.json` (TS config), `package.json` (scripts/deps).

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server for local development.
- `npm run build`: type-check with `tsc` and build the production bundle.
- `npm run preview`: serve the built bundle locally for verification.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules). Keep modules small and single-purpose.
- Indentation: 2 spaces (follow existing files).
- Naming: prefer lower-case file names matching their responsibility (e.g., `panel.ts`, `controls.ts`).
- No formatter/linter is configured. Keep style consistent with existing code and avoid unused exports.

## Testing Guidelines
- No automated test framework is configured yet. If you add tests, document the framework and add a script to `package.json` (e.g., `npm run test`).
- Suggested naming: `*.test.ts` in a `tests/` folder or alongside modules.

## Commit & Pull Request Guidelines
- This repository does not include Git history, so no commit convention is established. If you start one, prefer a clear, imperative subject line (e.g., "Add map clustering").
- PRs should include: a concise summary, linked issue if applicable, and screenshots for UI changes.

## Configuration & Data Notes
- Public data files are served as-is; keep `public/data/cities.json` small and validate JSON before committing.
- When adding new data assets, document their schema in the PR description.
