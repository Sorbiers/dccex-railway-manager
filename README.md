# DCC-EX Railway Manager

A full-stack web application for controlling [DCC-EX](https://dcc-ex.com/) model railroads. It provides a mobile-first interface to drive locomotives, throw turnouts, control color-light signals, and run timed schedules — all talking to a DCC-EX command station over the network.

> ⚠️ **Work in progress.** This project is under active development. Features may be incomplete or change without notice, and breaking changes can land at any time. Use at your own risk.

## Features

- **Throttle control** — per-train speed, direction, and DCC function controls (lights, sound, etc.) with a live speedometer gauge.
- **Train management** — add, edit, enable/disable locomotives, assign DCC addresses, function presets, and images.
- **Layout control** — a dedicated tab for switching turnouts (left, right, wye, three-way, double-slip, curved) and color-light signals (2- and 3-aspect) backed by DCC-EX virtual GPIO pins.
- **Schedules** — define and simulate timed sequences of commands across devices.
- **Settings** — configure the DCC-EX command station connection (host/port).
- **Real-time updates** — WebSocket push for connection status and device state.
- Light and dark themes.

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | Angular 19 + Angular Material, standalone components, signals |
| Backend | Node.js + Express + TypeScript, WebSocket (`ws`) |
| Command station | DCC-EX EX-CommandStation over TCP |

The backend exposes a REST API under `/api`, proxies DCC commands to the command station, and (in a production build) serves the compiled Angular app as static files. The frontend talks to the backend over HTTP and a `/ws` WebSocket.

```
Browser (Angular)  ──HTTP/WS──►  Backend (Express)  ──TCP──►  DCC-EX command station
```

## Prerequisites

- Node.js 20+
- A DCC-EX command station reachable over the network (WiThrottle/native TCP, default `192.168.4.1:2560`)

## Getting started (development)

Run the backend and frontend in two terminals.

**Backend** (API on `http://localhost:3000`):

```bash
cd backend
npm install
npm run dev
```

**Frontend** (dev server on `http://localhost:4200`):

```bash
cd frontend
npm install
npm start
```

Open <http://localhost:4200> and set your command station host/port on the Settings page.

## Production build

On Windows, `build-release.bat` builds both projects and assembles a `release/` folder (backend `dist` + the Angular build under `public/`) plus a `release.zip`:

```bash
build-release.bat
```

Then run the bundled server:

```bash
cd release
npm install --omit=dev
node server.js
```

The server serves both the API and the frontend from a single port (default `3000`, override with the `PORT` env var).

## Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| Backend port | `3000` | `PORT` environment variable |
| DCC-EX host | `192.168.4.1` | configurable in the app's Settings page |
| DCC-EX port | `2560` | configurable in the app's Settings page |

Runtime data (devices, schedules, settings) is persisted as JSON under `backend/src/data/` and is git-ignored.

## Project structure

```
backend/    Express + TypeScript API and DCC-EX TCP client
frontend/   Angular 19 application
types/      Shared TypeScript types
```

## License

[MIT](LICENSE)
