# Repository Guidelines

## Project Structure & Module Organization

This repository is a full-stack DCC-EX railway manager. `frontend/` contains the Angular 19 app, with standalone components under `frontend/src/app`, assets under `frontend/src/assets`, and dev proxy settings in `frontend/proxy.conf.json`. `backend/` contains the Node.js/Express TypeScript API, with routes in `backend/src/routes`, services in `backend/src/services`, assets in `backend/src/assets`, and JSON runtime data in `backend/data`. Shared contracts live in `types/index.ts`. Deployment files are at the root and in `deploy/`; generated outputs such as `dist/`, `release/`, and `release.zip` should not be edited by hand.

## Build, Test, and Development Commands

Install dependencies separately in `backend/` and `frontend/` with `npm install`.

- `cd backend && npm run dev`: start the API with `ts-node-dev` on port 3000.
- `cd frontend && npm start`: run Angular dev server with `/api` and `/ws` proxied to port 3000.
- `cd backend && npm run build`: compile backend TypeScript to `backend/dist`.
- `cd frontend && npm run build`: create the production Angular build.
- `docker compose up -d --build`: build and run the combined production container.
- `.\build-release.bat`: build both apps and package `release.zip`.

## Coding Style & Naming Conventions

Use TypeScript with strict compiler settings. Follow the existing two-space indentation style in Angular files; keep backend formatting consistent with nearby code. Use standalone components named `*.component.ts`, colocated with `*.component.html` and `*.component.scss` when needed. Use PascalCase for classes, camelCase for variables and methods, and kebab-case for component directories. Keep shared interfaces in `types/index.ts` when both apps need them.

## Testing Guidelines

No automated test script is currently defined. For now, validate changes with `npm run build` in the affected package, plus a local smoke test using the backend and Angular dev servers. When adding tests, place them beside covered code using Angular `*.spec.ts` names for frontend units, and add the corresponding `npm test` script.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often prefixed with `Fix:` or phrases such as `Add scheduler engine`. Keep commits focused and describe behavior changed. Pull requests should include a concise summary, manual verification steps, linked issues when applicable, and screenshots or short recordings for UI changes.

## Security & Configuration Tips

Do not commit local command-station credentials, private hostnames, or generated runtime data. Treat `backend/data/*.json` as local state unless intentionally updating defaults. Review `deploy.bat` before use because it contains environment-specific server details.
