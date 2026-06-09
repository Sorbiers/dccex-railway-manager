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

- Node.js 20+ (for local development), **or** Docker — for containerized deployment
- A DCC-EX command station reachable over the network (WiThrottle/native TCP, default `192.168.4.1:2560`)

## Quick start with Docker (recommended)

The whole app (frontend + backend on a single port) ships as one image. With [Docker](https://docs.docker.com/get-docker/) installed:

```bash
docker compose up -d --build
```

Then open <http://localhost:3000> and set your command station host/port on the Settings page.

- The image is multi-stage: it builds the Angular frontend and the TypeScript backend, then runs a slim production image that serves both.
- Devices, schedules, and settings persist in the `dccex-data` named volume across restarts and rebuilds.
- Override the published port with the `PORT` env var, e.g. `PORT=8080 docker compose up -d`.
- A `/api/health` healthcheck is built in (`docker compose ps` shows health status).

Common operations:

```bash
docker compose logs -f      # follow logs
docker compose down         # stop and remove the container (data volume kept)
docker compose down -v      # also remove the data volume (wipes saved devices/schedules)
```

> **Reaching the command station:** the container talks to your DCC-EX station over its network address (set in Settings). The default bridge network reaches LAN devices via NAT. If your station is only reachable on the host LAN segment and the bridge can't see it, uncomment `network_mode: host` in `docker-compose.yml` (Linux only).

## Native (no-Docker) deployment — Raspberry Pi kiosk

For a battery-powered Raspberry Pi kiosk, running natively instead of in Docker
removes the docker/containerd boot cost (~15–20 s) and a background daemon, which
helps boot time and idle power. With Node.js 20+ installed:

```bash
./deploy/install-native.sh
```

This builds the frontend + backend, serves the Angular build as static files from
the backend, and installs a `dccex.service` systemd unit (see `deploy/dccex.service`)
that runs the app on port 3000 at boot as the current user.

- The service user must be in the `video` group so the app can write the panel
  backlight for idle screen blanking (`BACKLIGHT_PATH` / `BACKLIGHT_MAX` in the unit).
- Migrating from Docker: copy the JSON out of the volume into `backend/dist/data/`
  before first start, then `docker compose down` and disable Docker:
  ```bash
  sudo cp /var/lib/docker/volumes/dccex-railway-manager_dccex-data/_data/*.json backend/dist/data/
  docker compose down && sudo systemctl disable --now docker.socket docker.service containerd
  ```

```bash
sudo systemctl status dccex.service     # check
sudo systemctl restart dccex.service    # after a rebuild
journalctl -u dccex.service -f          # follow logs
```

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
