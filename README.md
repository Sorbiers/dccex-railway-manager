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

## Installation on Raspberry Pi 4 with DSI screen (kiosk)

The intended deployment is a Raspberry Pi 4 driving an **800×480 DSI touch panel**
in fullscreen kiosk mode, often on a battery/power bank. For that target, run the
app **natively** (not in Docker): it removes the docker/containerd boot cost
(~15–20 s) and a background daemon, lowering boot time and idle power.

> Verified on a Pi 4B (2 GB) / Raspberry Pi OS (Debian 13, Wayland + labwc):
> boot ≈ **28 s**, free RAM ≈ **730 MB**, with the backend ready ~7 s into boot.

### 1. Install the app as a service

Requires **Node.js 20+**. If it isn't installed, the simplest reliable way on a
64-bit Pi is the official tarball:

```bash
VER=v20.18.1
curl -fsSL https://nodejs.org/dist/$VER/node-$VER-linux-arm64.tar.xz -o /tmp/node.tar.xz
sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
sudo ln -sf /usr/local/bin/node /usr/bin/node && sudo ln -sf /usr/local/bin/npm /usr/bin/npm
```

Then, from a clone of this repo:

```bash
git clone https://github.com/Sorbiers/dccex-railway-manager.git
cd dccex-railway-manager
./deploy/install-native.sh        # builds FE+BE, installs & starts dccex.service
```

`install-native.sh` builds the frontend + backend, publishes the Angular build to
`backend/dist/public`, and installs the **`dccex.service`** systemd unit
([deploy/dccex.service](deploy/dccex.service)) that serves the app on port 3000 at
boot as the current user. Open `http://localhost:3000` and set your command-station
host/port on the Settings page.

- The service user **must be in the `video` group** (`sudo usermod -aG video $USER`)
  so the app can write the panel backlight for idle screen blanking.
- The unit uses `Restart=always` (survives crashes) and does **not** wait for the
  network — the UI is served from localhost, and the backend retries its DCC-EX
  connection until WiFi is up, so the screen comes up without waiting for WiFi.

### 2. Kiosk browser

Raspberry Pi OS (labwc/Wayland) launches Chromium fullscreen from
`~/.config/labwc/autostart`:

```sh
# Wait for the backend, then launch the kiosk
for i in $(seq 1 60); do curl -sf http://localhost:3000/api/health >/dev/null 2>&1 && break; sleep 1; done
/usr/bin/lwrespawn /usr/bin/chromium --kiosk --ozone-platform=wayland \
  --password-store=basic --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble http://localhost:3000 &
```

### 3. Performance / power tuning (recommended)

```bash
# Drop boot cruft not needed on a kiosk (~tens of seconds + RAM):
sudo systemctl disable --now NetworkManager-wait-online.service \
  bluetooth.service cups.service cups.socket cups.path \
  avahi-daemon.service avahi-daemon.socket rpcbind.service rpcbind.socket nfs-blkmap.service
sudo touch /etc/cloud/cloud-init.disabled   # if cloud-init is present

# Slim the desktop: stop the taskbar/desktop (Chromium --kiosk covers them).
# Comment out the wf-panel-pi and pcmanfm-pi lines in /etc/xdg/labwc/autostart.
```

In `/boot/firmware/config.txt` (applies on reboot): `dtoverlay=disable-bt` and
`dtparam=act_led_trigger=none,pwr_led_trigger=none` (and their `*_activelow=off`).

**Idle screen blanking** is built in: after **30 min** (track power on) / **5 min**
(off) the backlight turns off; any touch wakes it. Toggle **Settings → Disable
screen off** to keep it always on. (`BACKLIGHT_PATH` / `BACKLIGHT_MAX` in the unit
select the panel; default is the DSI panel `…/10-0045`.)

> **Power supply:** check `vcgencmd get_throttled` reads `0x0`. A non-zero value
> means under-voltage/throttling — use a true 5 V/3 A USB-C supply and a thick
> cable; software tuning can't compensate for a weak power bank.
>
> **Boot note (WiFi-gated login):** after the above, boot is dominated by WiFi
> bring-up. On this hardware NetworkManager takes ~14 s, almost all of it a WiFi
> driver/firmware *pre-association* stall (the association + DHCP itself is ~1 s) —
> this is firmware-level, not a config knob. The Angular UI is served from
> localhost and the backend is decoupled from the network, so **the backend is
> ready ~7 s into boot**, but the **graphical login still appears ~23 s** in:
> `lightdm` waits on `systemd-user-sessions.service`, whose vendor unit is ordered
> `After=network.target` (→ NetworkManager). That ordering is re-imposed by reverse
> dependencies and does **not** clear via a simple drop-in, so it's left as-is.
>
> `wayvnc` (VNC) is **disabled** on this deployment
> (`sudo systemctl disable --now wayvnc wayvnc-control`); re-enable if you want
> remote screen access. Disabling it frees a background service but does **not**
> speed boot-to-screen, since the login is gated by `network.target` regardless.
> To get the screen up before WiFi you'd have to tackle the WiFi driver/firmware
> stall itself — best done with physical access so a bad WiFi change can't lock
> you out remotely.

### 4. Updating the app

```bash
cd ~/dccex-railway-manager
git pull
cd frontend && npm install && npm run build && cd ..
cd backend  && npm install && npm run build && cd ..
rm -rf backend/dist/public && cp -r frontend/dist/dccex-frontend/browser backend/dist/public
sudo systemctl restart dccex.service
```

(Equivalently, re-run `./deploy/install-native.sh`.) Manage the service with:

```bash
sudo systemctl status dccex.service     # check
sudo systemctl restart dccex.service    # after a rebuild
journalctl -u dccex.service -f          # follow logs
```

### Migrating from a previous Docker install

```bash
sudo cp /var/lib/docker/volumes/dccex-railway-manager_dccex-data/_data/*.json backend/dist/data/
docker compose down
sudo systemctl disable --now docker.socket docker.service containerd
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
